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
import { useNavigate } from 'react-router-dom';
import {
  Folder, FolderOpen, FileText, Plus, Search, ChevronRight, ChevronDown,
  MoreVertical, Play, Edit, Trash2, Copy, Move, FolderPlus, File,
  GripVertical, Check, X, Filter, SortAsc, Grid, List, RefreshCw,
  Layers, Zap, Clock, CheckCircle, AlertCircle, Tag, Star, StarOff,
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL TYPES FOR SUITES, RELEASES, RUNS
// ═══════════════════════════════════════════════════════════════════════════

interface TestSuite {
  id: string;
  name: string;
  description?: string;
  testCaseIds: string[];
  folderId?: string;
  schedule?: 'daily' | 'weekly' | 'on-demand';
  lastRun?: {
    date: string;
    passed: number;
    failed: number;
    total: number;
  };
  createdAt: string;
}

interface Release {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  planIds?: string[]; // Link to test plans
  status: 'planning' | 'active' | 'completed';
  suiteIds: string[];
  createdAt: string;
}

interface StepResult {
  stepIndex: number;
  stepName: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration?: number;
  error?: string;
  screenshot?: string;
  timestamp?: string;
}

interface TestRun {
  id: string;
  name: string;
  testCaseId?: string;       // Single test case (legacy)
  testCaseIds?: string[];    // Multiple test cases
  suiteId?: string;
  releaseId?: string;
  planId?: string;
  mode: 'manual' | 'automated';
  executionMode?: 'sequential' | 'parallel';  // How to run multiple tests
  status: 'pending' | 'running' | 'passed' | 'failed' | 'blocked';
  startTime: string;
  endTime?: string;
  executedBy?: string;
  results?: {
    passed: number;
    failed: number;
    skipped: number;
  };
  // Per-test results when running multiple tests
  testResults?: Array<{
    testCaseId: string;
    testName: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
    stepResults?: StepResult[];
    duration?: number;
    errorMessage?: string;
  }>;
  stepResults?: StepResult[];  // For single test runs
  logs?: string[];
  errorMessage?: string;
  failedStep?: number;
  currentTestIndex?: number;  // Track which test is running in multi-test run
}

interface TestPlan {
  id: string;
  name: string;
  description?: string;
  releaseId?: string;
  suiteIds: string[];
  testCaseIds: string[];
  status: 'draft' | 'ready' | 'in-progress' | 'completed';
  environment?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
  lastRun?: {
    date: string;
    passed: number;
    failed: number;
    blocked: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TestFolder {
  id: string;
  name: string;
  parentId: string | null;
  children: string[]; // folder IDs
  testCases: string[]; // test case IDs
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

interface TestCase {
  id: string;
  name: string;
  description?: string;
  folderId: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'draft' | 'ready' | 'approved' | 'deprecated';
  automationStatus?: 'none' | 'partial' | 'full';
  lastResult?: 'passed' | 'failed' | 'skipped';
  lastRun?: string;
  tags?: string[];
  starred?: boolean;
  steps?: any[];
  unified_data?: {
    steps?: any[];
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface TreeNode {
  id: string;
  type: 'folder' | 'test';
  name: string;
  data: TestFolder | TestCase;
  children?: TreeNode[];
  expanded?: boolean;
  depth: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT FOLDERS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_FOLDERS: TestFolder[] = [
  { id: 'root', name: 'Test Repository', parentId: null, children: ['smoke', 'regression', 'integration', 'e2e'], testCases: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'smoke', name: '🔥 Smoke Tests', parentId: 'root', children: [], testCases: [], color: '#ef4444', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'regression', name: '🔄 Regression', parentId: 'root', children: [], testCases: [], color: '#f59e0b', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'integration', name: '🔗 Integration', parentId: 'root', children: [], testCases: [], color: '#10b981', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'e2e', name: '🎯 End-to-End', parentId: 'root', children: [], testCases: [], color: '#3b82f6', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// ═══════════════════════════════════════════════════════════════════════════
// FOLDER TREE ITEM
// ═══════════════════════════════════════════════════════════════════════════

interface TreeItemProps {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  onToggle: (id: string) => void;
  onDragStart: (e: React.DragEvent, node: TreeNode) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetNode: TreeNode) => void;
  onContextMenu: (node: TreeNode) => void;
  expandedFolders: Set<string>;
  onRename?: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => void;
  onDuplicate?: (node: TreeNode) => void;
  testCases?: TestCase[];  // Pass test cases to calculate folder counts
}

function TreeItem({
  node,
  selectedId,
  onSelect,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  expandedFolders,
  onRename,
  onDelete,
  onDuplicate,
  testCases = []
}: TreeItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;
  
  const testCase = node.type === 'test' ? node.data as TestCase : null;
  const folder = node.type === 'folder' ? node.data as TestFolder : null;
  const isRootFolder = node.id === 'root';
  
  // Calculate folder test count from testCases state (accurate count)
  const folderTestCount = node.type === 'folder' 
    ? testCases.filter(tc => tc.folderId === node.id || (node.id === 'root' && !tc.folderId)).length
    : 0;
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const getStatusIcon = () => {
    if (!testCase) return null;
    switch (testCase.lastResult) {
      case 'passed': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  return (
    <div className="relative">
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, node)}
        onClick={() => onSelect(node)}
        onContextMenu={handleContextMenu}
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors group",
          isSelected 
            ? "bg-amber-500/20 text-amber-400" 
            : "hover:bg-gray-800 text-gray-300",
          "select-none"
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      >
        {/* Expand/Collapse */}
        {node.type === 'folder' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 hover:bg-gray-700 rounded"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <span className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500" />
          )
        ) : (
          <FileText className="w-4 h-4 text-gray-400" />
        )}

        {/* Name */}
        <span className="flex-1 truncate text-sm">{node.name}</span>

        {/* Test case indicators */}
        {testCase && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {getStatusIcon()}
            {testCase.automationStatus === 'full' && (
              <Zap className="w-3.5 h-3.5 text-blue-400" />
            )}
            {testCase.starred && (
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            )}
          </div>
        )}

        {/* Folder count badge */}
        {node.type === 'folder' && (
          <Badge className="h-5 px-1.5 text-xs bg-gray-800 text-gray-400 opacity-0 group-hover:opacity-100">
            {folderTestCount}
          </Badge>
        )}

        {/* Drag handle and menu button */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e);
            }}
            className="p-0.5 hover:bg-gray-700 rounded"
          >
            <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <GripVertical className="w-3.5 h-3.5 text-gray-600 cursor-grab" />
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div 
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {node.type === 'folder' ? (
            <>
              <button
                onClick={() => {
                  onRename?.(node);
                  setShowContextMenu(false);
                }}
                disabled={isRootFolder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pencil className="w-4 h-4" />
                Rename Folder
              </button>
              <button
                onClick={() => {
                  onDelete?.(node);
                  setShowContextMenu(false);
                }}
                disabled={isRootFolder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete Folder
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onRename?.(node);
                  setShowContextMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                <Pencil className="w-4 h-4" />
                Rename Test
              </button>
              <button
                onClick={() => {
                  onDuplicate?.(node);
                  setShowContextMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                <Copy className="w-4 h-4" />
                Duplicate Test
              </button>
              <div className="border-t border-gray-700 my-1" />
              <button
                onClick={() => {
                  onDelete?.(node);
                  setShowContextMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800"
              >
                <Trash2 className="w-4 h-4" />
                Delete Test
              </button>
            </>
          )}
        </div>
      )}

      {/* Children */}
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onContextMenu={() => {}}
              expandedFolders={expandedFolders}
              onRename={onRename}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              testCases={testCases}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASE CARD (for grid view)
// ═══════════════════════════════════════════════════════════════════════════

function TestCaseCard({
  testCase,
  onSelect,
  onRun,
  onEdit,
  onStar,
  isSelected
}: {
  testCase: TestCase;
  onSelect: () => void;
  onRun: () => void;
  onEdit: () => void;
  onStar: () => void;
  isSelected: boolean;
}) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "bg-gray-900/50 border-gray-800 cursor-pointer transition-all hover:border-amber-500/30 group",
        isSelected && "border-amber-500 ring-1 ring-amber-500/30"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {testCase.lastResult === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {testCase.lastResult === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
            {!testCase.lastResult && <Clock className="w-4 h-4 text-gray-500" />}
            <h3 className="font-medium text-white truncate">{testCase.name}</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStar();
            }}
            className="p-1 hover:bg-gray-800 rounded"
          >
            {testCase.starred ? (
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            ) : (
              <StarOff className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        {testCase.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{testCase.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {testCase.automationStatus === 'full' && (
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">Auto</Badge>
            )}
            {testCase.automationStatus === 'partial' && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Partial</Badge>
            )}
            {(!testCase.automationStatus || testCase.automationStatus === 'none') && (
              <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20 text-xs">Manual</Badge>
            )}
            {testCase.priority && (
              <Badge
                className={cn(
                  "text-xs",
                  testCase.priority === 'critical' && "bg-red-500/10 text-red-400",
                  testCase.priority === 'high' && "bg-orange-500/10 text-orange-400",
                  testCase.priority === 'medium' && "bg-amber-500/10 text-amber-400",
                  testCase.priority === 'low' && "bg-gray-500/10 text-gray-400"
                )}
              >
                {testCase.priority}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-500/10"
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tags */}
        {testCase.tags && testCase.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {testCase.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                {tag}
              </span>
            ))}
            {testCase.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{testCase.tags.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUN RESULTS DIALOG
// ═══════════════════════════════════════════════════════════════════════════

function TestRunResultsDialog({ 
  open, 
  onClose, 
  run, 
  testCase,
  testCases,
  onRerun 
}: { 
  open: boolean; 
  onClose: () => void; 
  run: TestRun | null;
  testCase: TestCase | null;
  testCases?: TestCase[];
  onRerun?: () => void;
}) {
  const [expandedTest, setExpandedTest] = useState<number | null>(null);
  
  if (!run) return null;

  const isManual = run.mode === 'manual';
  const isMultiTest = (run.testCaseIds && run.testCaseIds.length > 1) || (run.testResults && run.testResults.length > 1);
  
  // Get step results based on mode
  let stepResults: StepResult[] = [];
  let manualTestResults: Array<{
    testCaseId: string;
    testName: string;
    status: string;
    steps: StepResult[];
  }> = [];
  
  if (isManual && run.manualStepResults) {
    // For manual runs, get results from manualStepResults
    const testIds = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);
    
    if (testIds.length > 1) {
      // Multi-test manual run
      manualTestResults = testIds.map(tcId => {
        const tc = testCases?.find(t => t.id === tcId);
        const results = run.manualStepResults?.[tcId] || [];
        const hasFailures = results.some((r: StepResult) => r.status === 'failed');
        const allPassed = results.length > 0 && results.every((r: StepResult) => r.status === 'passed' || r.status === 'skipped');
        return {
          testCaseId: tcId,
          testName: tc?.name || tcId,
          status: hasFailures ? 'failed' : allPassed ? 'passed' : 'pending',
          steps: results
        };
      });
    } else if (testIds.length === 1) {
      // Single test manual run
      stepResults = run.manualStepResults?.[testIds[0]] || [];
    }
  } else {
    // For automated runs, use stepResults or testResults
    stepResults = run.stepResults || [];
  }
  
  const testResults = isManual ? manualTestResults : (run.testResults || []);
  
  // Calculate totals
  let totalSteps = 0;
  let passedSteps = 0;
  let failedSteps = 0;
  
  if (isMultiTest && testResults.length > 0) {
    totalSteps = testResults.length;
    passedSteps = testResults.filter(t => t.status === 'passed').length;
    failedSteps = testResults.filter(t => t.status === 'failed').length;
  } else if (stepResults.length > 0) {
    totalSteps = stepResults.length;
    passedSteps = stepResults.filter(s => s.status === 'passed').length;
    failedSteps = stepResults.filter(s => s.status === 'failed').length;
  }
  const duration = run.endTime && run.startTime 
    ? Math.round((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 1000)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-gray-900 border-gray-800">
        <DialogHeader className="border-b border-gray-800 pb-4">
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className={cn(
              "p-2 rounded-lg",
              run.status === 'passed' ? "bg-emerald-500/20" : 
              run.status === 'failed' ? "bg-red-500/20" : "bg-gray-700"
            )}>
              {run.status === 'passed' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : run.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <Clock className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <span className="text-lg">{run.name}</span>
              <div className="text-sm text-gray-400 font-normal mt-0.5">
                {testCase?.name || 'Test Execution Results'}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] py-4 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{totalSteps}</div>
              <div className="text-xs text-gray-400">{isMultiTest ? 'Total Tests' : 'Total Steps'}</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{passedSteps}</div>
              <div className="text-xs text-emerald-400/70">Passed</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{failedSteps}</div>
              <div className="text-xs text-red-400/70">Failed</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{duration}s</div>
              <div className="text-xs text-gray-400">Duration</div>
            </div>
          </div>

          {/* Execution Mode Info */}
          <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
            <Badge className={cn(
              "text-xs",
              run.mode === 'manual' ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
            )}>
              {run.mode === 'manual' ? '📋 Manual Execution' : '🤖 Automated Execution'}
            </Badge>
            {isMultiTest && (
              <>
                <Badge className={cn(
                  "text-xs",
                  run.executionMode === 'parallel' ? "bg-purple-500/10 text-purple-400" : "bg-gray-500/10 text-gray-400"
                )}>
                  {run.executionMode === 'parallel' ? 'Parallel' : 'Sequential'}
                </Badge>
                <span>•</span>
                <span>{testResults.length} test cases</span>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {totalSteps > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Progress</span>
                <span>{Math.round((passedSteps / totalSteps) * 100)}% passed</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${(passedSteps / totalSteps) * 100}%` }} 
                />
                <div 
                  className="bg-red-500 h-full transition-all duration-500" 
                  style={{ width: `${(failedSteps / totalSteps) * 100}%` }} 
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {run.errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-400 mb-1">Execution Failed</div>
                  <p className="text-sm text-red-300/80">{run.errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results - Multi-test or Single-test */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {isMultiTest ? 'Test Results' : 'Step Results'}
            </h3>
            <div className="space-y-2">
              {isMultiTest ? (
                // Multi-test results with expandable details
                testResults.length > 0 ? (
                  testResults.map((testResult, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg border transition-colors",
                        testResult.status === 'passed' ? "bg-emerald-900/10 border-emerald-800/50" :
                        testResult.status === 'failed' ? "bg-red-900/20 border-red-800/50" :
                        testResult.status === 'skipped' ? "bg-gray-800/50 border-gray-700/50" :
                        "bg-amber-900/10 border-amber-800/50"
                      )}
                    >
                      <div 
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
                        onClick={() => setExpandedTest(expandedTest === idx ? null : idx)}
                      >
                        <div className="flex-shrink-0">
                          {testResult.status === 'passed' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                          ) : testResult.status === 'failed' ? (
                            <AlertCircle className="h-5 w-5 text-red-400" />
                          ) : testResult.status === 'skipped' ? (
                            <Clock className="h-5 w-5 text-gray-500" />
                          ) : (
                            <RefreshCw className="h-5 w-5 text-amber-400 animate-spin" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                                Test {idx + 1}
                              </span>
                              <span className="text-sm text-white font-medium truncate">
                                {testResult.testName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {testResult.duration !== undefined && (
                                <span className="text-xs text-gray-500">
                                  {Math.round(testResult.duration / 1000)}s
                                </span>
                              )}
                              {testResult.stepResults && testResult.stepResults.length > 0 && (
                                <span className="text-xs text-gray-500">
                                  {testResult.stepResults.filter(s => s.status === 'passed').length}/
                                  {testResult.stepResults.length} steps
                                </span>
                              )}
                              <ChevronDown className={cn(
                                "w-4 h-4 text-gray-400 transition-transform",
                                expandedTest === idx && "transform rotate-180"
                              )} />
                            </div>
                          </div>
                          {testResult.errorMessage && (
                            <div className="mt-1 text-xs text-red-400 truncate">
                              Error: {testResult.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Expanded test details - handles both automated and manual step results */}
                      {expandedTest === idx && ((testResult as any).stepResults?.length > 0 || (testResult as any).steps?.length > 0) && (
                        <div className="border-t border-gray-800 p-3 space-y-2 bg-black/20">
                          <div className="text-xs text-gray-400 mb-2">Step Details:</div>
                          {((testResult as any).stepResults || (testResult as any).steps || []).map((step: any, stepIdx: number) => (
                            <div
                              key={stepIdx}
                              className={cn(
                                "rounded p-2 text-sm flex items-start gap-2",
                                step.status === 'passed' ? "bg-emerald-900/20" :
                                step.status === 'failed' ? "bg-red-900/30" :
                                step.status === 'skipped' ? "bg-gray-800/30" :
                                "bg-gray-800/50"
                              )}
                            >
                              {step.status === 'passed' ? (
                                <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                              ) : step.status === 'failed' ? (
                                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                              ) : step.status === 'skipped' ? (
                                <Clock className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Clock className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                                    Step {(step.stepIndex ?? stepIdx) + 1}
                                  </span>
                                  <span className="text-gray-300">{step.stepName || `Step ${(step.stepIndex ?? stepIdx) + 1}`}</span>
                                  {step.duration && (
                                    <span className="text-xs text-gray-500">({step.duration}ms)</span>
                                  )}
                                  {step.defectId && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 flex items-center gap-1">
                                      <Bug className="w-3 h-3" />
                                      {step.defectId}
                                    </span>
                                  )}
                                </div>
                                {step.notes && (
                                  <div className="mt-1 text-xs text-gray-400">
                                    Notes: {step.notes}
                                  </div>
                                )}
                                {(step.error || step.errorMessage) && (
                                  <div className="mt-1 text-xs text-red-300 bg-red-900/30 rounded p-1">
                                    {step.error || step.errorMessage}
                                  </div>
                                )}
                                {/* Single screenshot (automated) */}
                                {step.screenshot && typeof step.screenshot === 'string' && (
                                  <img 
                                    src={step.screenshot} 
                                    alt={`Screenshot`}
                                    className="mt-2 rounded border border-gray-700 max-h-32 cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(step.screenshot, '_blank')}
                                  />
                                )}
                                {/* Multiple screenshots (manual) */}
                                {step.screenshots && step.screenshots.length > 0 && (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {step.screenshots.map((img: string, imgIdx: number) => (
                                      <img 
                                        key={imgIdx}
                                        src={img} 
                                        alt={`Screenshot ${imgIdx + 1}`}
                                        className="rounded border border-gray-700 h-20 cursor-pointer hover:opacity-80"
                                        onClick={() => window.open(img, '_blank')}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No test results available</p>
                  </div>
                )
              ) : (
                // Single test step results (both automated and manual)
                stepResults.length > 0 ? (
                  stepResults.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        step.status === 'passed' ? "bg-emerald-900/10 border-emerald-800/50" :
                        step.status === 'failed' ? "bg-red-900/20 border-red-800/50" :
                        step.status === 'skipped' ? "bg-gray-800/50 border-gray-700/50" :
                        "bg-amber-900/10 border-amber-800/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {step.status === 'passed' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                          ) : step.status === 'failed' ? (
                            <AlertCircle className="h-5 w-5 text-red-400" />
                          ) : step.status === 'skipped' ? (
                            <Clock className="h-5 w-5 text-gray-500" />
                          ) : (
                            <RefreshCw className="h-5 w-5 text-amber-400 animate-spin" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                                Step {(step.stepIndex ?? idx) + 1}
                              </span>
                              <span className="text-sm text-white font-medium truncate">
                                {step.stepName || `Step ${(step.stepIndex ?? idx) + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.duration !== undefined && (
                                <span className="text-xs text-gray-500">
                                  {step.duration}ms
                                </span>
                              )}
                              {step.defectId && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 flex items-center gap-1">
                                  <Bug className="w-3 h-3" />
                                  {step.defectId}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Notes (manual execution) */}
                          {step.notes && (
                            <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-300">
                              <span className="text-gray-500">Notes:</span> {step.notes}
                            </div>
                          )}
                          
                          {/* Error message */}
                          {(step.error || step.errorMessage) && (
                            <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300 font-mono">
                              {step.error || step.errorMessage}
                            </div>
                          )}
                          
                          {/* Defect details */}
                          {step.defectTitle && (
                            <div className="mt-2 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs">
                              <div className="flex items-center gap-2 text-red-400 font-medium">
                                <Bug className="w-3 h-3" />
                                {step.defectId}
                              </div>
                              <div className="text-gray-300 mt-1">{step.defectTitle}</div>
                            </div>
                          )}
                          
                          {/* Single screenshot (automated) */}
                          {step.screenshot && typeof step.screenshot === 'string' && (
                            <div className="mt-2">
                              <img 
                                src={step.screenshot} 
                                alt={`Screenshot for step ${(step.stepIndex ?? idx) + 1}`}
                                className="rounded border border-gray-700 max-h-48 cursor-pointer hover:opacity-80"
                                onClick={() => window.open(step.screenshot, '_blank')}
                              />
                            </div>
                          )}
                          
                          {/* Multiple screenshots (manual execution) */}
                          {step.screenshots && step.screenshots.length > 0 && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {step.screenshots.map((img: string, imgIdx: number) => (
                                <img 
                                  key={imgIdx}
                                  src={img} 
                                  alt={`Screenshot ${imgIdx + 1}`}
                                  className="rounded border border-gray-700 h-24 w-full object-cover cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(img, '_blank')}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No step results available</p>
                    <p className="text-xs mt-1">Run the test to see detailed results</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Execution Logs */}
          {run.logs && run.logs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Execution Logs
              </h3>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                  {run.logs.join('\n')}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
            <span>Started: {run.startTime ? new Date(run.startTime).toLocaleString() : 'N/A'}</span>
            <span>Ended: {run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A'}</span>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-800 pt-4">
          <div className="flex gap-2 w-full justify-between">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Close
            </Button>
            <div className="flex gap-2">
              {onRerun && (
                <Button
                  onClick={() => {
                    onClose();
                    onRerun();
                  }}
                  className="bg-amber-600 hover:bg-amber-500"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rerun Test
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TestRepository() {
  const navigate = useNavigate();
  
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
  const BATCH_SIZE = 100; // Load 100 more each time
  
  // Filter state for enterprise scale
  const [statusFilter, setStatusFilter] = useState<'all' | 'none' | 'partial' | 'full'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
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

    // Load test cases from multiple sources
    const loadAllTestCases = async () => {
      const allCases: TestCase[] = [];
      const seenIds = new Set<string>();
      
      // Helper: Calculate automation status based on step coverage
      const calculateAutomationStatus = (tc: any): 'none' | 'partial' | 'full' => {
        // First check if already has correct status saved
        if (tc.automationStatus === 'full' || tc.automationStatus === 'automated') {
          console.log(`[Status] ${tc.name}: Using saved status 'full'`);
          return 'full';
        }
        
        // Get steps from unified_data or steps array
        let steps = tc.unified_data?.steps || tc.steps || [];
        if (typeof tc.unified_data === 'string') {
          try {
            const parsed = JSON.parse(tc.unified_data);
            steps = parsed?.steps || steps;
            console.log(`[Status] ${tc.name}: Parsed unified_data string, got ${steps.length} steps`);
          } catch (e) {
            console.warn(`[Status] ${tc.name}: Failed to parse unified_data`);
          }
        }
        
        if (!steps || steps.length === 0) {
          console.log(`[Status] ${tc.name}: No steps found, returning 'none'`);
          return 'none';
        }
        
        // Count automated steps - must have REAL automation data:
        // - qword (GoTo, Fill, ClickText, etc.) WITH args, OR
        // - selectorObj (from recording), OR
        // - automationStatus explicitly set to 'recorded'
        const automatedSteps = steps.filter((s: any) => {
          // Must have qword with args (actual recorded action)
          if (s.qword && s.args && s.args.length > 0) return true;
          // Or have selector object from recording
          if (s.selectorObj && Object.keys(s.selectorObj).length > 0) return true;
          // Or explicitly marked as recorded
          if (s.automationStatus === 'recorded') return true;
          return false;
        });
        
        console.log(`[Status] ${tc.name}: ${automatedSteps.length}/${steps.length} automated steps`);
        if (automatedSteps.length > 0) {
          console.log(`[Status] First automated step has: qword=${automatedSteps[0].qword}, args=${JSON.stringify(automatedSteps[0].args)}`);
        }
        
        if (automatedSteps.length === steps.length) return 'full';  // All automated
        if (automatedSteps.length > 0) return 'partial';  // Some automated
        return 'none';  // Manual only
      };
      
      // 0. Check if we should load from backend scale database (for large datasets)
      const useScaleDb = localStorage.getItem('use_scale_db') === 'true';
      if (useScaleDb) {
        try {
          console.log('[Repository] Loading from backend scale database...');
          const response = await fetch('http://localhost:8000/test-cases/scale-data');
          if (response.ok) {
            const data = await response.json();
            console.log('[Repository] Loaded from scale DB:', data.testCases?.length || 0, 'test cases');
            for (const tc of (data.testCases || [])) {
              if (tc.id && !seenIds.has(tc.id)) {
                seenIds.add(tc.id);
                allCases.push({
                  id: tc.id,
                  name: tc.name,
                  description: tc.description || '',
                  folderId: tc.folder_id || null,
                  folderName: tc.folder_name || undefined,
                  priority: tc.priority || 'medium',
                  status: tc.status || 'ready',
                  automationStatus: (tc.automation_status as 'none' | 'partial' | 'full') || 'none',
                  automationScriptPath: tc.automation_script_path || undefined,
                  tags: tc.tags || [],
                  steps: tc.steps || [],
                  createdAt: tc.created_at,
                  updatedAt: tc.updated_at
                });
              }
            }
            // Also load suites, plans, releases if present
            if (data.suites?.length > 0) {
              console.log('[Repository] Saving suites to localStorage:', data.suites.length);
              localStorage.setItem('test_suites', JSON.stringify(data.suites));
            }
            if (data.plans?.length > 0) {
              console.log('[Repository] Saving plans to localStorage:', data.plans.length);
              localStorage.setItem('test_plans', JSON.stringify(data.plans));
            }
            if (data.releases?.length > 0) {
              console.log('[Repository] Saving releases to localStorage:', data.releases.length);
              localStorage.setItem('test_releases', JSON.stringify(data.releases));
            }
            // Trigger reload of related data
            window.dispatchEvent(new CustomEvent('reload-related-data'));
          }
        } catch (e) {
          console.log('[Repository] Scale DB not available, falling back to other sources');
        }
      }
      
      // 1. From Electron local storage (JSON files on disk) - primary source in desktop app
      try {
        const electronAPI = (window as any).electronAPI || (window as any).flowstral;
        if (electronAPI?.localStorage?.getTestCases) {
          const electronCases = await electronAPI.localStorage.getTestCases();
          console.log('[Repository] Loaded from Electron storage:', electronCases?.length || 0, 'test cases');
          for (const tc of (electronCases || [])) {
            if (tc.id && !seenIds.has(tc.id)) {
              seenIds.add(tc.id);
              allCases.push({
                ...tc,
                folderId: tc.folderId || null,
                automationStatus: calculateAutomationStatus(tc)
              });
            }
          }
        }
      } catch (e) {
        console.log('[Repository] Electron storage not available, using browser localStorage');
      }
      
      // 2. From browser localStorage test_cases key
      try {
        const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
        for (const tc of localCases) {
          if (tc.id && !seenIds.has(tc.id)) {
            seenIds.add(tc.id);
            allCases.push({
              ...tc,
              folderId: tc.folderId || null,
              automationStatus: calculateAutomationStatus(tc)
            });
          }
        }
      } catch (e) {}
      
      // 3. From unified_test_case_* keys (legacy format)
      const keys = Object.keys(localStorage).filter(k => k.startsWith('unified_test_case_'));
      for (const key of keys) {
        try {
          const tc = JSON.parse(localStorage.getItem(key) || '{}');
          if (tc.id && !seenIds.has(tc.id)) {
            seenIds.add(tc.id);
            allCases.push({
              ...tc,
              folderId: tc.folderId || null,
              automationStatus: calculateAutomationStatus(tc)
            });
          }
        } catch (e) {}
      }
      
      console.log('[Repository] Total test cases loaded:', allCases.length);
      setTestCases(allCases);
    };
    
    loadAllTestCases();
    
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
    
    // Apply sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'priority') {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2);
      }
      // Default: sort by updated
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
    
    return result;
  }, [currentFolderContent.tests, statusFilter, priorityFilter, sortBy]);
  
  // Prioritized sort: newest first, then by priority
  const prioritizedTests = useMemo(() => {
    return [...filteredTests].sort((a, b) => {
      // First priority: recently updated
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      
      // Second priority: by priority level
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2);
    });
  }, [filteredTests]);
  
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
  
  const handleRunTest = useCallback((testCase: TestCase) => {
    setTestCaseToRun(testCase);
    setShowRunTestDialog(true);
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

  const handleConfirmDelete = useCallback(() => {
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
      setTestCases(prev => {
        const updated = prev.filter(tc => tc.id !== testId);
        localStorage.setItem('test_cases', JSON.stringify(updated));
        return updated;
      });
      toast.success('Test case deleted');
    }
    
    setShowDeleteConfirmDialog(false);
    setDeletingItem(null);
  }, [deletingItem]);

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

  // Additional state for tabs
  const [activeTab, setActiveTab] = useState<'repository' | 'suites' | 'plans' | 'releases' | 'runs'>('repository');
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [executingStepIndex, setExecutingStepIndex] = useState<number>(-1);
  
  // Check if running in Electron desktop app
  const isElectron = useCallback(() => {
    return typeof window !== 'undefined' && 
           ((window as any).electronAPI?.isElectron === true || (window as any).platform?.isElectron === true);
  }, []);
  
  // Convert step from Builder format to Executor format (qword-based)
  const convertStepToExecutorFormat = useCallback((step: any) => {
    // If step has test_data, parse it to get the actual step object
    let actualStep = step;
    if (step.test_data && typeof step.test_data === 'string') {
      try {
        actualStep = { ...step, ...JSON.parse(step.test_data) };
      } catch (e) {
        console.warn('[Convert] Failed to parse test_data:', e);
      }
    }
    
    // Map Builder step types to Executor qword actions
    const typeToQword: Record<string, string> = {
      'navigate': 'GoTo',
      'goto': 'GoTo',
      'click': 'ClickText', // Default to ClickText for better compatibility
      'fill': 'Fill',
      'input': 'Fill',
      'type': 'Fill',
      'select': 'Select',
      'hover': 'Hover',
      'wait': 'Wait',
      'wait_for_element': 'WaitForElement',
      'wait_for_text': 'WaitForText',
      'assert': 'AssertText',
      'assert_text': 'AssertText',
      'assert_element': 'AssertElement',
      'screenshot': 'Screenshot',
      'press': 'Press',
      'keyboard': 'Press',
      'scroll': 'Scroll',
    };

    // Get the action type - check multiple possible properties
    // Priority: qword (recorder format) > type (builder format) > action
    const stepType = actualStep.qword || actualStep.type || 'unknown';
    let qword = actualStep.qword || typeToQword[stepType.toLowerCase()] || stepType;
    
    // If qword is still undefined/unknown, try to infer from name/description
    if (qword === 'unknown' || !qword) {
      const name = (actualStep.name || actualStep.description || '').toLowerCase();
      if (name.includes('navigate') || name.includes('goto') || name.includes('go to')) {
        qword = 'GoTo';
      } else if (name.includes('fill') || name.includes('type') || name.includes('input')) {
        qword = 'Fill';
      } else if (name.includes('click')) {
        qword = 'ClickText';
      } else if (name.includes('wait')) {
        qword = 'Wait';
      } else if (name.includes('assert')) {
        qword = 'AssertText';
      }
    }

    // Build args array based on step type
    let args: string[] = actualStep.args || [];
    if (args.length === 0) {
      // Build args from step properties
      if (qword === 'GoTo') {
        args = [actualStep.url || actualStep.value || ''];
      } else if (qword === 'Fill') {
        // Fill needs selector and value
        const selector = actualStep.selector || actualStep.selectorObj?.selector || 
                        actualStep.selectorObj?.name || actualStep.target || '';
        args = [selector, actualStep.value || ''];
      } else if (qword === 'ClickElement') {
        args = [actualStep.selector || actualStep.selectorObj?.selector || actualStep.target || ''];
      } else if (qword === 'ClickText') {
        // Extract text from name like 'Click "Log In"' or from target
        const name = actualStep.name || '';
        const textMatch = name.match(/[Cc]lick\s*"([^"]+)"/);
        const clickText = textMatch ? textMatch[1] : (actualStep.value || actualStep.text || actualStep.target || '');
        args = [clickText];
      } else if (qword === 'Wait') {
        args = [String(actualStep.waitTime || actualStep.value || 1000)];
      } else if (qword === 'AssertText') {
        args = [actualStep.value || actualStep.expectedResult || ''];
      } else if (qword === 'Select') {
        args = [actualStep.selector || actualStep.selectorObj?.selector || '', actualStep.value || ''];
      } else if (qword === 'Press') {
        args = [actualStep.value || actualStep.key || 'Enter'];
      }
    }

    const converted = {
      id: actualStep.id,
      qword: qword,
      type: stepType, // Keep original type as fallback
      args: args,
      selector: actualStep.selector,
      selectorObj: actualStep.selectorObj,
      value: actualStep.value,
      url: actualStep.url,
      enabled: actualStep.enabled !== false,
      description: actualStep.name || actualStep.description || `${qword} ${args[0] || ''}`,
      assertion: actualStep.assertion,
    };
    
    console.log('[Convert] Step:', actualStep.name, '-> qword:', converted.qword, 'args:', converted.args);
    return converted;
  }, []);

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

  // Load suites, plans, releases, runs
  useEffect(() => {
    const loadRelatedData = () => {
      const savedSuites = localStorage.getItem('test_suites');
      if (savedSuites) {
        try {
          const parsed = JSON.parse(savedSuites);
          console.log('[Repository] Loading suites from localStorage:', parsed.length);
          setSuites(parsed);
        } catch (e) {}
      }
      
      const savedPlans = localStorage.getItem('test_plans');
      if (savedPlans) {
        try {
          const parsed = JSON.parse(savedPlans);
          console.log('[Repository] Loading plans from localStorage:', parsed.length);
          setTestPlans(parsed);
        } catch (e) {}
      }
      
      const savedReleases = localStorage.getItem('test_releases');
      if (savedReleases) {
        try {
          const parsed = JSON.parse(savedReleases);
          console.log('[Repository] Loading releases from localStorage:', parsed.length);
          setReleases(parsed);
        } catch (e) {}
      }
      
      const savedRuns = localStorage.getItem('test_execution_history');
      if (savedRuns) setTestRuns(JSON.parse(savedRuns));
    };
    
    loadRelatedData();
    
    // Also reload when scale data is loaded
    const handleReloadRelated = () => loadRelatedData();
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
    runs: testRuns.length
  }), [testCases, suites, releases, testRuns]);

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header with Tabs */}
      <header className="flex-none border-b border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
              <FolderTree className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Test Management</h1>
              <p className="text-xs text-gray-500">
                {stats.totalTests} tests • {stats.suites} suites • {stats.releases} releases
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
                  'Search...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-gray-900 border-gray-700 text-white h-9"
              />
              {searchLoading && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />
              )}
            </div>

            {/* Context-aware actions */}
            {activeTab === 'repository' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    console.log('[Repository] Manual refresh triggered - checking backend for scale data');
                    toast.info('Checking for scale data...');
                    try {
                      const response = await fetch('http://localhost:8000/test-cases/scale-data');
                      if (response.ok) {
                        const data = await response.json();
                        if (data.testCases && data.testCases.length > 100) {
                          localStorage.setItem('use_scale_db', 'true');
                          console.log('[Repository] Scale data found:', data.testCases.length, 'test cases - enabling backend load');
                          toast.success(`Found ${data.testCases.length} test cases in database!`);
                        }
                      }
                    } catch (e) {
                      console.log('[Repository] Backend not available');
                    }
                    window.dispatchEvent(new CustomEvent('reload-test-cases'));
                  }}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  title="Refresh test cases from storage"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewFolderDialog(true)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
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
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Test
                </Button>
              </>
            )}
            {activeTab === 'suites' && (
              <Button
                size="sm"
                onClick={() => setShowCreateSuiteDialog(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
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
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Plan
              </Button>
            )}
            {activeTab === 'releases' && (
              <Button
                size="sm"
                onClick={() => setShowCreateReleaseDialog(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Release
              </Button>
            )}
            {activeTab === 'runs' && (
              <Button
                size="sm"
                onClick={() => setShowCreateRunDialog(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Run
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation - Following proper test management workflow */}
        <div className="px-4 flex items-center gap-1 border-t border-gray-800/50 overflow-x-auto">
          {[
            { id: 'repository', label: 'Test Cases', icon: FolderTree, count: stats.totalTests, desc: 'All test cases' },
            { id: 'suites', label: 'Suites', icon: Layers, count: stats.suites, desc: 'Group related tests' },
            { id: 'plans', label: 'Plans', icon: Target, count: testPlans.length, desc: 'Execution plans' },
            { id: 'releases', label: 'Releases', icon: Rocket, count: stats.releases, desc: 'Sprint/version' },
            { id: 'runs', label: 'Runs', icon: PlayCircle, count: stats.runs, desc: 'Execution history' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <Badge className="h-5 px-1.5 text-xs bg-gray-800 text-gray-400">{tab.count}</Badge>
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === 'repository' && (
        /* Main Repository content */
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Tree View */}
          <aside className="w-64 flex-none border-r border-gray-800 overflow-y-auto bg-gray-900/30">
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
                          "flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800",
                          folder.id === currentFolderId ? "text-amber-400" : "text-gray-400"
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
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-800">
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
                      className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      title="Select all tests on this page"
                    />
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-gray-400">
                      {filteredTests.length === currentFolderContent.tests.length 
                        ? `${currentFolderContent.tests.length} tests` 
                        : `${filteredTests.length} of ${currentFolderContent.tests.length} tests`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-gray-400">{currentFolderContent.subfolders.length} folders</span>
                  </div>
                  
                  <div className="flex-1" />
                  
                  {/* Filters for scale testing */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Status</option>
                    <option value="full">Automated</option>
                    <option value="partial">Partial</option>
                    <option value="none">Manual</option>
                  </select>
                  
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Priority</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="updated">Sort by Updated</option>
                    <option value="name">Sort by Name</option>
                    <option value="priority">Sort by Priority</option>
                  </select>
                  
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-400">
                      {currentFolderContent.tests.filter(t => t.automationStatus === 'automated' || t.automationStatus === 'full').length} automated
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">
                      {currentFolderContent.tests.filter(t => !t.automationStatus || t.automationStatus === 'none').length} manual
                    </span>
                  </div>
                </div>

                {/* All Test Cases - Clean Table View */}
                {currentFolderContent.tests.length > 0 || currentFolderContent.subfolders.length > 0 ? (
                  <div className="space-y-1">
                    {/* Inline subfolders (quick navigation + drop targets) */}
                    {currentFolderContent.subfolders.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-800/50">
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
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800 transition-all text-sm"
                          >
                            <FolderOpen className="w-4 h-4 text-amber-500" />
                            <span className="text-gray-300">{folder.name}</span>
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
                        <Check className="w-5 h-5 text-amber-400" />
                        <span className="text-sm text-white font-medium">
                          {selectedTestIds.size} test{selectedTestIds.size > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex-1" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-500">
                              <Move className="w-4 h-4 mr-1" />
                              Move to Folder
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-gray-900 border-gray-700">
                            <DropdownMenuItem 
                              className="text-gray-300 focus:bg-gray-800"
                              onClick={() => handleBulkMoveToFolder(null)}
                            >
                              <Home className="w-4 h-4 mr-2" />
                              Root (Test Repository)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            {folders.filter(f => f.id !== 'root').map(folder => (
                              <DropdownMenuItem 
                                key={folder.id}
                                className="text-gray-300 focus:bg-gray-800"
                                onClick={() => handleBulkMoveToFolder(folder.id)}
                              >
                                <Folder className="w-4 h-4 mr-2 text-amber-500" />
                                {folder.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={clearSelection}
                          className="text-gray-400 hover:text-white"
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
                            ? "bg-amber-500/20 border-amber-500/50"
                            : selectedNode?.id === tc.id
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-gray-900/30 border-gray-800 hover:bg-gray-800/50 hover:border-gray-700"
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
                          className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500 flex-none cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        {/* Drag handle */}
                        <GripVertical className="w-4 h-4 text-gray-600 cursor-grab active:cursor-grabbing flex-none" />
                        
                        {/* Status indicator */}
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-none",
                          tc.automationStatus === 'automated' || tc.automationStatus === 'full' ? "bg-blue-500" :
                          tc.automationStatus === 'partial' ? "bg-amber-500" : "bg-gray-600"
                        )} />
                        
                        {/* Test info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white truncate">{tc.name}</h4>
                            <Badge className={cn(
                              "text-[10px] px-1.5",
                              (tc.automationStatus === 'automated' || tc.automationStatus === 'full') && "bg-green-500/10 text-green-400",
                              tc.automationStatus === 'partial' && "bg-amber-500/10 text-amber-400",
                              (tc.automationStatus === 'none' || !tc.automationStatus) && "bg-gray-500/10 text-gray-400"
                            )}>
                              {tc.automationStatus === 'automated' || tc.automationStatus === 'full' ? 'Automated' : 
                               tc.automationStatus === 'partial' ? 'Partial' : 'Manual'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {tc.steps?.length || 0} steps • Updated {tc.updatedAt ? new Date(tc.updatedAt).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10"
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
                            className="h-8 px-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10"
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
                                className="h-8 px-2 text-gray-400 hover:text-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                              <DropdownMenuItem 
                                className="text-gray-300 focus:bg-gray-800"
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
                                className="text-gray-300 focus:bg-gray-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTestConfig(tc);
                                }}
                              >
                                <Settings className="w-4 h-4 mr-2" /> Edit Configuration
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-gray-300 focus:bg-gray-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarTest(tc.id);
                                }}
                              >
                                <Star className={cn("w-4 h-4 mr-2", tc.starred && "fill-amber-400 text-amber-400")} />
                                {tc.starred ? 'Unstar' : 'Star'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-gray-300 focus:bg-gray-800"
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
                              <DropdownMenuSeparator className="bg-gray-700" />
                              <DropdownMenuItem 
                                className="text-red-400 focus:bg-red-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this test case?')) {
                                    setTestCases(prev => prev.filter(t => t.id !== tc.id));
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
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-400">
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
                          className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300"
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
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No tests yet</h3>
                    <p className="text-gray-500 mb-4">Start by recording or creating a test case</p>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        onClick={() => navigate('/recorder')}
                        variant="outline"
                        className="border-gray-700 text-gray-300"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Record Test
                      </Button>
                      <Button
                        onClick={() => navigate('/test-cases/builder')}
                        className="bg-gradient-to-r from-amber-500 to-orange-500"
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
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto">
            {/* Search results info */}
            {searchTerm.trim() && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <span className="text-amber-400">
                  Found {filteredSuites.length} suites matching "{searchTerm}"
                </span>
              </div>
            )}
            {filteredSuites.length === 0 ? (
              <div className="text-center py-16">
                <Layers className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm.trim() ? 'No Matching Suites' : 'No Test Suites'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm.trim() ? `No suites found matching "${searchTerm}"` : 'Create suites to group related tests for execution'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSuites.map((suite) => (
                  <Card key={suite.id} className="bg-gray-900/50 border-gray-800 hover:border-amber-500/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{suite.name}</h3>
                          {suite.description && (
                            <p className="text-sm text-gray-500 mt-1">{suite.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            <Badge className="bg-gray-800 text-gray-300">
                              {suite.testCaseIds.length} tests
                            </Badge>
                            {suite.schedule && (
                              <Badge className="bg-blue-500/10 text-blue-400">
                                <Clock className="w-3 h-3 mr-1" />
                                {suite.schedule}
                              </Badge>
                            )}
                            {suite.lastRun && (
                              <span className="text-xs text-gray-500">
                                Last run: {new Date(suite.lastRun.date).toLocaleDateString()}
                                <span className="ml-2 text-green-400">{suite.lastRun.passed}✓</span>
                                <span className="ml-1 text-red-400">{suite.lastRun.failed}✗</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              toast.info(`Running suite: ${suite.name}`);
                            }}
                            className="bg-green-600 hover:bg-green-500"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Run
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                              <DropdownMenuItem 
                                className="text-gray-300 focus:bg-gray-800"
                                onClick={() => handleEditSuite(suite)}
                              >
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-gray-300 focus:bg-gray-800">
                                <Copy className="w-4 h-4 mr-2" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-700" />
                              <DropdownMenuItem 
                                className="text-red-400 focus:bg-red-500/10"
                                onClick={() => handleDeleteSuite(suite.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RELEASES TAB */}
      {activeTab === 'releases' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto">
            {/* Search results info */}
            {searchTerm.trim() && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <span className="text-amber-400">
                  Found {filteredReleases.length} releases matching "{searchTerm}"
                </span>
              </div>
            )}
            {filteredReleases.length === 0 ? (
              <div className="text-center py-16">
                <Rocket className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm.trim() ? 'No Matching Releases' : 'No Releases'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm.trim() ? `No releases found matching "${searchTerm}"` : 'Create releases to track testing across sprints'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredReleases.map((release) => (
                  <Card key={release.id} className="bg-gray-900/50 border-gray-800 hover:border-amber-500/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{release.name}</h3>
                            <Badge className={cn(
                              "text-xs",
                              release.status === 'planning' && "bg-blue-500/10 text-blue-400",
                              release.status === 'active' && "bg-green-500/10 text-green-400",
                              release.status === 'completed' && "bg-gray-500/10 text-gray-400"
                            )}>
                              {release.status}
                            </Badge>
                          </div>
                          {release.description && (
                            <p className="text-sm text-gray-500 mt-1">{release.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(release.startDate).toLocaleDateString()}
                              {release.endDate && ` - ${new Date(release.endDate).toLocaleDateString()}`}
                            </span>
                            <Badge className="bg-gray-800 text-gray-300">
                              {release.suiteIds.length} suites
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 text-gray-300"
                          >
                            <Target className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                              <DropdownMenuItem 
                                className="text-gray-300 focus:bg-gray-800"
                                onClick={() => handleEditRelease(release)}
                              >
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-gray-300 focus:bg-gray-800">
                                <Copy className="w-4 h-4 mr-2" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-700" />
                              <DropdownMenuItem 
                                className="text-red-400 focus:bg-red-500/10"
                                onClick={() => handleDeleteRelease(release.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto">
            {/* Search results info */}
            {searchTerm.trim() && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <span className="text-amber-400">
                  Found {filteredPlans.length} plans matching "{searchTerm}"
                </span>
              </div>
            )}
            {filteredPlans.length === 0 ? (
              <div className="text-center py-16">
                <Target className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm.trim() ? 'No Matching Plans' : 'No Test Plans'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm.trim() ? `No plans found matching "${searchTerm}"` : 'Create plans to organize test execution for releases'}
                </p>
                <Button 
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
                  className="bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Test Plan
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredPlans.map((plan) => {
                  const linkedSuites = suites.filter(s => plan.suiteIds.includes(s.id));
                  const linkedRelease = releases.find(r => r.id === plan.releaseId);
                  const totalTests = plan.testCaseIds.length + linkedSuites.reduce((acc, s) => acc + s.testCaseIds.length, 0);
                  
                  return (
                    <Card key={plan.id} className="bg-gray-900/50 border-gray-800 hover:border-amber-500/30 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white">{plan.name}</h3>
                              <Badge className={cn(
                                "text-xs",
                                plan.status === 'draft' && "bg-gray-500/10 text-gray-400",
                                plan.status === 'ready' && "bg-blue-500/10 text-blue-400",
                                plan.status === 'in-progress' && "bg-amber-500/10 text-amber-400",
                                plan.status === 'completed' && "bg-green-500/10 text-green-400"
                              )}>
                                {plan.status}
                              </Badge>
                            </div>
                            {plan.description && (
                              <p className="text-sm text-gray-500 mb-2">{plan.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <span className="flex items-center gap-1 text-gray-400">
                                <FileText className="w-3 h-3" />
                                {totalTests} tests
                              </span>
                              <span className="flex items-center gap-1 text-gray-400">
                                <Layers className="w-3 h-3" />
                                {plan.suiteIds.length} suites
                              </span>
                              {linkedRelease && (
                                <span className="flex items-center gap-1 text-purple-400">
                                  <Rocket className="w-3 h-3" />
                                  {linkedRelease.name}
                                </span>
                              )}
                              {plan.lastRun && (
                                <span className="text-gray-500">
                                  Last run: {new Date(plan.lastRun.date).toLocaleDateString()}
                                  <span className="ml-2 text-green-400">{plan.lastRun.passed}✓</span>
                                  <span className="ml-1 text-red-400">{plan.lastRun.failed}✗</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                // Create a new test run from this plan
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
                              className="bg-green-600 hover:bg-green-500"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Run
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                                <DropdownMenuItem 
                                  className="text-gray-300 focus:bg-gray-800"
                                  onClick={() => {
                                    setEditingPlan(plan);
                                    setShowEditPlanDialog(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-gray-300 focus:bg-gray-800"
                                  onClick={() => {
                                    setEditingPlan(plan);
                                    setShowLinkPlanToReleaseDialog(true);
                                  }}
                                >
                                  <Link2 className="w-4 h-4 mr-2" /> Link to Release
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-gray-300 focus:bg-gray-800"
                                  onClick={() => {
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
                                >
                                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem 
                                  className="text-red-400 focus:bg-red-500/10"
                                  onClick={() => {
                                    if (!confirm('Delete this test plan?')) return;
                                    setTestPlans(prev => {
                                      const updated = prev.filter(p => p.id !== plan.id);
                                      localStorage.setItem('test_plans', JSON.stringify(updated));
                                      return updated;
                                    });
                                    toast.success('Plan deleted');
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
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
          </div>
        </div>
      )}

      {/* RUNS TAB */}
      {activeTab === 'runs' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto">
            {testRuns.length === 0 ? (
              <div className="text-center py-16">
                <PlayCircle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold mb-2">No Test Runs</h3>
                <p className="text-gray-500 mb-4">Create a test run to execute your test cases</p>
                <Button 
                  onClick={() => setShowCreateRunDialog(true)}
                  className="bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Test Run
                </Button>
                <div className="mt-6 p-4 bg-gray-800/50 rounded-lg max-w-md mx-auto">
                  <p className="text-gray-400 text-sm">
                    <strong className="text-amber-400">Automated:</strong> Runs tests via Playwright in desktop app<br/>
                    <strong className="text-blue-400">Manual:</strong> Step-by-step execution with screenshots & defect linking
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Execution Summary */}
                {(() => {
                  const totalRuns = testRuns.length;
                  const passedRuns = testRuns.filter(r => r.status === 'passed').length;
                  const failedRuns = testRuns.filter(r => r.status === 'failed').length;
                  const pendingRuns = testRuns.filter(r => r.status === 'pending').length;
                  const runningRuns = testRuns.filter(r => r.status === 'running').length;
                  const passRate = totalRuns > 0 ? Math.round((passedRuns / (totalRuns - pendingRuns - runningRuns)) * 100) || 0 : 0;
                  
                  return (
                    <div className="grid grid-cols-5 gap-3 mb-4">
                      <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-white">{totalRuns}</div>
                        <div className="text-xs text-gray-400">Total Runs</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-emerald-400">{passedRuns}</div>
                        <div className="text-xs text-emerald-400/70">Passed</div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-400">{failedRuns}</div>
                        <div className="text-xs text-red-400/70">Failed</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-amber-400">{pendingRuns + runningRuns}</div>
                        <div className="text-xs text-amber-400/70">Pending</div>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-purple-400">{passRate}%</div>
                        <div className="text-xs text-purple-400/70">Pass Rate</div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Run List */}
                <div className="space-y-2">
                {testRuns.slice(0, 50).map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 hover:border-gray-700 group"
                  >
                    <div className="flex items-center gap-3">
                      {run.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                      {run.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-500" />}
                      {run.status === 'running' && <Clock className="w-5 h-5 text-amber-500 animate-pulse" />}
                      {run.status === 'pending' && <Clock className="w-5 h-5 text-gray-500" />}
                      {run.status === 'blocked' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{run.name || 'Test Run'}</p>
                          {(run.testCaseIds?.length || 0) > 1 && (
                            <Badge className="text-xs bg-purple-500/10 text-purple-400">
                              {run.testCaseIds?.length} tests
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(run.startTime).toLocaleString()} • {run.mode}
                          {run.executionMode && run.testCaseIds && run.testCaseIds.length > 1 && 
                            ` • ${run.executionMode}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {run.results && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-400">{run.results.passed}✓</span>
                          <span className="text-red-400">{run.results.failed}✗</span>
                          <span className="text-gray-400">{run.results.skipped}○</span>
                        </div>
                      )}
                      <Badge className={cn(
                        "text-xs",
                        run.mode === 'automated' ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
                      )}>
                        {run.mode}
                      </Badge>
                      {run.status === 'pending' && (run.testCaseId || (run.testCaseIds && run.testCaseIds.length > 0)) && (
                        <Button
                          size="sm"
                          className={cn(
                            "h-7 px-3",
                            run.mode === 'manual' 
                              ? "bg-amber-600 hover:bg-amber-500" 
                              : "bg-green-600 hover:bg-green-500"
                          )}
                          disabled={run.mode === 'automated' && (executingRunId === run.id || executingRunId !== null)}
                          onClick={async () => {
                            const testIds = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);
                            if (testIds.length === 0) return;
                            
                            // Manual mode: Navigate to step-level execution
                            if (run.mode === 'manual') {
                              navigate(`/execution/run/${run.id}/${testIds[0]}`);
                              return;
                            }
                            
                            // Automated mode: Execute via Playwright in Electron
                            if (isElectron()) {
                              if (testIds.length === 1) {
                                await executeTestDirectly(testIds[0], run.id);
                              } else {
                                await executeMultipleTests(testIds, run.id, run.executionMode || 'sequential');
                              }
                            } else {
                              // In browser: navigate to builder for automated test
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
                        >
                          <Play className="w-3 h-3 mr-1" />
                          {run.mode === 'manual' 
                            ? 'Start Manual Test' 
                            : executingRunId === run.id 
                              ? 'Running...' 
                              : (run.testCaseIds?.length || 1) > 1 
                                ? `Run ${run.testCaseIds?.length} Tests` 
                                : 'Execute'}
                        </Button>
                      )}
                      {run.status === 'running' && executingRunId === run.id && (
                        <div className="flex items-center gap-2 text-xs text-amber-400">
                          <Clock className="w-3 h-3 animate-spin" />
                          {run.testCaseIds && run.testCaseIds.length > 1 
                            ? `Test ${(run.currentTestIndex || 0) + 1}/${run.testCaseIds.length}`
                            : `Step ${executingStepIndex + 1}`}
                        </div>
                      )}
                      {/* View Results button for completed runs */}
                      {(run.status === 'passed' || run.status === 'failed') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 border-gray-700 text-gray-300 hover:bg-gray-800"
                          onClick={() => {
                            setSelectedRunForResults(run);
                            setShowResultsDialog(true);
                          }}
                        >
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Results
                        </Button>
                      )}
                      {/* Rerun button for completed runs */}
                      {(run.status === 'passed' || run.status === 'failed') && (run.testCaseId || (run.testCaseIds && run.testCaseIds.length > 0)) && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-500 h-7 px-3"
                          disabled={run.mode === 'automated' && executingRunId !== null}
                          onClick={async () => {
                            const testIds = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);
                            if (testIds.length === 0) return;
                            
                            // Create new run
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
                            
                            // Manual mode: Navigate to step-level execution
                            if (run.mode === 'manual') {
                              toast.success('Starting manual re-run...');
                              navigate(`/execution/run/${newRunId}/${testIds[0]}`);
                              return;
                            }
                            
                            // Automated mode: Execute via Playwright in Electron
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
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Rerun
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                          <DropdownMenuItem 
                            className="text-gray-300 focus:bg-gray-800"
                            onClick={() => {
                              setSelectedRunForResults(run);
                              setShowResultsDialog(true);
                            }}
                          >
                            <BarChart3 className="w-4 h-4 mr-2" /> View Results
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-gray-300 focus:bg-gray-800"
                            disabled={!run.testCaseId || executingRunId !== null}
                            onClick={async () => {
                              if (!run.testCaseId) return;
                              // Re-run: create new run and execute
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
                          >
                            <Play className="w-4 h-4 mr-2" /> Re-run
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-700" />
                          <DropdownMenuItem 
                            className="text-red-400 focus:bg-red-500/10"
                            onClick={() => handleDeleteRun(run.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Folder Name</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Login Tests, Payment Flow"
                className="bg-gray-800 border-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
            <p className="text-xs text-gray-500">
              Creating in: {breadcrumbPath.map(f => f.name.replace(/^[^\s]+\s/, '')).join(' / ')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)} className="border-gray-700">
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
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Folder Name</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="bg-gray-800 border-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditFolderDialog(false)} className="border-gray-700">
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
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Folder Name</label>
              <Input
                value={newFolderRename}
                onChange={(e) => setNewFolderRename(e.target.value)}
                placeholder="Enter folder name"
                className="bg-gray-800 border-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFolderRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameFolderDialog(false)} className="border-gray-700">
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
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">
                {deletingItem?.node.name}
              </span>
              ?
            </p>
            {deletingItem?.type === 'folder' && (
              <p className="text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg">
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
              className="border-gray-700"
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

      {/* Edit Suite Dialog */}
      <Dialog open={showEditSuiteDialog} onOpenChange={setShowEditSuiteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Test Suite</DialogTitle>
          </DialogHeader>
          {editingSuite && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Suite Name</label>
                <Input
                  value={editingSuite.name}
                  onChange={(e) => setEditingSuite({ ...editingSuite, name: e.target.value })}
                  placeholder="Enter suite name"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <Input
                  value={editingSuite.description || ''}
                  onChange={(e) => setEditingSuite({ ...editingSuite, description: e.target.value })}
                  placeholder="Enter description"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Schedule</label>
                <select
                  value={editingSuite.schedule || 'on-demand'}
                  onChange={(e) => setEditingSuite({ ...editingSuite, schedule: e.target.value as any })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="on-demand">On Demand</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSuiteDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button onClick={handleSaveSuite} className="bg-amber-500 hover:bg-amber-400">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Release Dialog */}
      <Dialog open={showEditReleaseDialog} onOpenChange={setShowEditReleaseDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Release</DialogTitle>
          </DialogHeader>
          {editingRelease && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Release Name</label>
                <Input
                  value={editingRelease.name}
                  onChange={(e) => setEditingRelease({ ...editingRelease, name: e.target.value })}
                  placeholder="Enter release name"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <Input
                  value={editingRelease.description || ''}
                  onChange={(e) => setEditingRelease({ ...editingRelease, description: e.target.value })}
                  placeholder="Enter description"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={editingRelease.startDate?.split('T')[0] || ''}
                    onChange={(e) => setEditingRelease({ ...editingRelease, startDate: e.target.value })}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={editingRelease.endDate?.split('T')[0] || ''}
                    onChange={(e) => setEditingRelease({ ...editingRelease, endDate: e.target.value })}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Status</label>
                <select
                  value={editingRelease.status}
                  onChange={(e) => setEditingRelease({ ...editingRelease, status: e.target.value as any })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Link Test Suites ({editingRelease.suiteIds?.length || 0} selected)
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-2 space-y-1">
                  {suites.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-2">No test suites available</p>
                  ) : (
                    suites.map((suite) => (
                      <label
                        key={suite.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                          editingRelease.suiteIds?.includes(suite.id) 
                            ? "bg-amber-500/10 border border-amber-500/30" 
                            : "hover:bg-gray-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={editingRelease.suiteIds?.includes(suite.id) || false}
                          onChange={(e) => {
                            const currentIds = editingRelease.suiteIds || [];
                            if (e.target.checked) {
                              setEditingRelease({ ...editingRelease, suiteIds: [...currentIds, suite.id] });
                            } else {
                              setEditingRelease({ ...editingRelease, suiteIds: currentIds.filter(id => id !== suite.id) });
                            }
                          }}
                          className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-white truncate">{suite.name}</span>
                        <span className="text-xs text-gray-500">({suite.testCaseIds.length} tests)</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Link Test Plans ({editingRelease.planIds?.length || 0} selected)
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-2 space-y-1">
                  {testPlans.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-2">No test plans available</p>
                  ) : (
                    testPlans.map((plan) => (
                      <label
                        key={plan.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                          editingRelease.planIds?.includes(plan.id) 
                            ? "bg-amber-500/10 border border-amber-500/30" 
                            : "hover:bg-gray-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={editingRelease.planIds?.includes(plan.id) || false}
                          onChange={(e) => {
                            const currentIds = editingRelease.planIds || [];
                            if (e.target.checked) {
                              setEditingRelease({ ...editingRelease, planIds: [...currentIds, plan.id] });
                            } else {
                              setEditingRelease({ ...editingRelease, planIds: currentIds.filter(id => id !== plan.id) });
                            }
                          }}
                          className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-white truncate">{plan.name}</span>
                        <Badge className="text-[10px] bg-gray-700">{plan.status}</Badge>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditReleaseDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button onClick={handleSaveRelease} className="bg-amber-500 hover:bg-amber-400">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Suite Dialog with Test Case Linking */}
      <Dialog open={showCreateSuiteDialog} onOpenChange={setShowCreateSuiteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Test Suite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Suite Name *</label>
              <Input
                value={newSuiteName}
                onChange={(e) => setNewSuiteName(e.target.value)}
                placeholder="e.g., Login Flow Tests, Checkout Regression"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description</label>
              <Input
                value={newSuiteDescription}
                onChange={(e) => setNewSuiteDescription(e.target.value)}
                placeholder="Brief description of this test suite"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Link Test Cases ({newSuiteTestCases.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-2 space-y-1">
                {testCases.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No test cases available</p>
                ) : (
                  testCases.map((tc) => (
                    <label
                      key={tc.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                        newSuiteTestCases.includes(tc.id) 
                          ? "bg-amber-500/10 border border-amber-500/30" 
                          : "hover:bg-gray-700"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={newSuiteTestCases.includes(tc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSuiteTestCases(prev => [...prev, tc.id]);
                          } else {
                            setNewSuiteTestCases(prev => prev.filter(id => id !== tc.id));
                          }
                        }}
                        className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{tc.name}</p>
                        <p className="text-xs text-gray-500">{tc.priority || 'No priority'} • {tc.automationStatus || 'none'}</p>
                      </div>
                      {tc.lastResult && (
                        <Badge className={cn(
                          "text-xs",
                          tc.lastResult === 'passed' ? "bg-green-500/10 text-green-400" :
                          tc.lastResult === 'failed' ? "bg-red-500/10 text-red-400" :
                          "bg-gray-500/10 text-gray-400"
                        )}>
                          {tc.lastResult}
                        </Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700"
                  onClick={() => setNewSuiteTestCases(testCases.map(tc => tc.id))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700"
                  onClick={() => setNewSuiteTestCases([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSuiteDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button onClick={handleCreateSuite} className="bg-amber-500 hover:bg-amber-400">
              Create Suite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Release Dialog with Suite Linking */}
      <Dialog open={showCreateReleaseDialog} onOpenChange={setShowCreateReleaseDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Release</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Release Name *</label>
              <Input
                value={newReleaseName}
                onChange={(e) => setNewReleaseName(e.target.value)}
                placeholder="e.g., Sprint 1.0, Q1 2024 Release"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description</label>
              <Input
                value={newReleaseDescription}
                onChange={(e) => setNewReleaseDescription(e.target.value)}
                placeholder="Brief description of this release"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={newReleaseStartDate}
                  onChange={(e) => setNewReleaseStartDate(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={newReleaseEndDate}
                  onChange={(e) => setNewReleaseEndDate(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Link Test Suites ({newReleaseSuites.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-2 space-y-1">
                {suites.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No test suites available. Create suites first.</p>
                ) : (
                  suites.map((suite) => (
                    <label
                      key={suite.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                        newReleaseSuites.includes(suite.id) 
                          ? "bg-amber-500/10 border border-amber-500/30" 
                          : "hover:bg-gray-700"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={newReleaseSuites.includes(suite.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewReleaseSuites(prev => [...prev, suite.id]);
                          } else {
                            setNewReleaseSuites(prev => prev.filter(id => id !== suite.id));
                          }
                        }}
                        className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{suite.name}</p>
                        <p className="text-xs text-gray-500">{suite.testCaseIds.length} test cases • {suite.schedule || 'on-demand'}</p>
                      </div>
                      {suite.lastRun && (
                        <div className="text-xs text-gray-500">
                          <span className="text-green-400">{suite.lastRun.passed}✓</span>
                          <span className="text-red-400 ml-1">{suite.lastRun.failed}✗</span>
                        </div>
                      )}
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700"
                  onClick={() => setNewReleaseSuites(suites.map(s => s.id))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700"
                  onClick={() => setNewReleaseSuites([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateReleaseDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button onClick={handleCreateRelease} className="bg-amber-500 hover:bg-amber-400">
              Create Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={showEditPlanDialog} onOpenChange={setShowEditPlanDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Test Plan</DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Plan Name *</label>
                <Input
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  placeholder="Enter plan name"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <Input
                  value={editingPlan.description || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  placeholder="Enter description"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Status</label>
                  <select
                    value={editingPlan.status}
                    onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Environment</label>
                  <Input
                    value={editingPlan.environment || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, environment: e.target.value })}
                    placeholder="e.g., QA, Staging, Prod"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Link Test Suites ({editingPlan.suiteIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-2 space-y-1">
                  {suites.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-2">No test suites available</p>
                  ) : (
                    suites.map((suite) => (
                      <label
                        key={suite.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                          editingPlan.suiteIds.includes(suite.id) 
                            ? "bg-amber-500/10 border border-amber-500/30" 
                            : "hover:bg-gray-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={editingPlan.suiteIds.includes(suite.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingPlan({ ...editingPlan, suiteIds: [...editingPlan.suiteIds, suite.id] });
                            } else {
                              setEditingPlan({ ...editingPlan, suiteIds: editingPlan.suiteIds.filter(id => id !== suite.id) });
                            }
                          }}
                          className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{suite.name}</p>
                          <p className="text-xs text-gray-500">{suite.testCaseIds.length} test cases</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Link Individual Test Cases ({editingPlan.testCaseIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-2 space-y-1">
                  {testCases.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-2">No test cases available</p>
                  ) : (
                    testCases.slice(0, 50).map((tc) => (
                      <label
                        key={tc.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                          editingPlan.testCaseIds.includes(tc.id) 
                            ? "bg-amber-500/10 border border-amber-500/30" 
                            : "hover:bg-gray-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={editingPlan.testCaseIds.includes(tc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingPlan({ ...editingPlan, testCaseIds: [...editingPlan.testCaseIds, tc.id] });
                            } else {
                              setEditingPlan({ ...editingPlan, testCaseIds: editingPlan.testCaseIds.filter(id => id !== tc.id) });
                            }
                          }}
                          className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-white truncate">{tc.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPlanDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button 
              onClick={() => {
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
              className="bg-amber-500 hover:bg-amber-400"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Details Dialog */}
      <Dialog open={showRunDetailsDialog} onOpenChange={setShowRunDetailsDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Test Run Details</DialogTitle>
          </DialogHeader>
          {selectedRun && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {selectedRun.status === 'passed' && <CheckCircle className="w-8 h-8 text-green-500" />}
                {selectedRun.status === 'failed' && <AlertCircle className="w-8 h-8 text-red-500" />}
                {selectedRun.status === 'running' && <Clock className="w-8 h-8 text-amber-500 animate-pulse" />}
                {selectedRun.status === 'pending' && <Clock className="w-8 h-8 text-gray-500" />}
                {selectedRun.status === 'blocked' && <AlertCircle className="w-8 h-8 text-yellow-500" />}
                <div>
                  <h3 className="font-semibold text-lg">{selectedRun.name}</h3>
                  <p className="text-sm text-gray-400">{selectedRun.mode} execution</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <Badge className={cn(
                    selectedRun.status === 'passed' && "bg-green-500/10 text-green-400",
                    selectedRun.status === 'failed' && "bg-red-500/10 text-red-400",
                    selectedRun.status === 'running' && "bg-amber-500/10 text-amber-400",
                    selectedRun.status === 'pending' && "bg-gray-500/10 text-gray-400",
                    selectedRun.status === 'blocked' && "bg-yellow-500/10 text-yellow-400"
                  )}>
                    {selectedRun.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Mode</p>
                  <Badge className={cn(
                    selectedRun.mode === 'automated' ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
                  )}>
                    {selectedRun.mode}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Started</p>
                  <p className="text-sm">{new Date(selectedRun.startTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ended</p>
                  <p className="text-sm">{selectedRun.endTime ? new Date(selectedRun.endTime).toLocaleString() : 'In progress'}</p>
                </div>
              </div>
              
              {selectedRun.results && (
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-3">Results</p>
                  <div className="flex items-center justify-around">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">{selectedRun.results.passed}</p>
                      <p className="text-xs text-gray-500">Passed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-400">{selectedRun.results.failed}</p>
                      <p className="text-xs text-gray-500">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-400">{selectedRun.results.skipped}</p>
                      <p className="text-xs text-gray-500">Skipped</p>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedRun.planId && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Target className="w-4 h-4" />
                  Plan: {testPlans.find(p => p.id === selectedRun.planId)?.name || 'Unknown'}
                </div>
              )}
              {selectedRun.releaseId && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Rocket className="w-4 h-4" />
                  Release: {releases.find(r => r.id === selectedRun.releaseId)?.name || 'Unknown'}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunDetailsDialog(false)} className="border-gray-700">
              Close
            </Button>
            {selectedRun && selectedRun.status !== 'running' && (
              <Button 
                onClick={() => {
                  // Re-run
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
                className="bg-green-600 hover:bg-green-500"
              >
                <Play className="w-4 h-4 mr-1" />
                Re-run
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Plan to Release Dialog */}
      <Dialog open={showLinkPlanToReleaseDialog} onOpenChange={setShowLinkPlanToReleaseDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Link Plan to Release</DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Select a release to link <strong>{editingPlan.name}</strong> to:
              </p>
              <div className="space-y-2">
                {releases.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No releases available. Create a release first.
                  </p>
                ) : (
                  releases.map((release) => (
                    <button
                      key={release.id}
                      onClick={() => {
                        setTestPlans(prev => {
                          const updated = prev.map(p => 
                            p.id === editingPlan.id 
                              ? { ...p, releaseId: release.id } 
                              : p
                          );
                          localStorage.setItem('test_plans', JSON.stringify(updated));
                          return updated;
                        });
                        setShowLinkPlanToReleaseDialog(false);
                        setEditingPlan(null);
                        toast.success(`Linked to ${release.name}`);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                        editingPlan.releaseId === release.id
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-gray-800/50 border-gray-700 hover:border-amber-500/30"
                      )}
                    >
                      <Rocket className="w-5 h-5 text-purple-400" />
                      <div className="flex-1">
                        <p className="font-medium text-white">{release.name}</p>
                        <p className="text-xs text-gray-500">{release.status} • {release.suiteIds.length} suites</p>
                      </div>
                      {editingPlan.releaseId === release.id && (
                        <CheckCircle className="w-5 h-5 text-amber-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
              {editingPlan.releaseId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-gray-700 text-gray-400"
                  onClick={() => {
                    setTestPlans(prev => {
                      const updated = prev.map(p => 
                        p.id === editingPlan.id 
                          ? { ...p, releaseId: undefined } 
                          : p
                      );
                      localStorage.setItem('test_plans', JSON.stringify(updated));
                      return updated;
                    });
                    setShowLinkPlanToReleaseDialog(false);
                    setEditingPlan(null);
                    toast.success('Unlinked from release');
                  }}
                >
                  Remove Link
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkPlanToReleaseDialog(false)} className="border-gray-700">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Test Case Dialog */}
      <Dialog open={showCreateTestDialog} onOpenChange={setShowCreateTestDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Test Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Test Name *</label>
              <Input
                value={newTestName}
                onChange={(e) => setNewTestName(e.target.value)}
                placeholder="e.g., User Login with Valid Credentials"
                className="bg-gray-800 border-gray-700"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description</label>
              <Input
                value={newTestDescription}
                onChange={(e) => setNewTestDescription(e.target.value)}
                placeholder="Brief description of what this test validates"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Priority</label>
                <select
                  value={newTestPriority}
                  onChange={(e) => setNewTestPriority(e.target.value as any)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Folder</label>
                <select
                  value={newTestFolder}
                  onChange={(e) => setNewTestFolder(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="root">Test Repository (Root)</option>
                  {folders.filter(f => f.id !== 'root').map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTestDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button 
              onClick={() => {
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
                // Save to state AND localStorage so builder can find it
                setTestCases(prev => {
                  const updated = [...prev, newTestCase];
                  localStorage.setItem('test_cases', JSON.stringify(updated));
                  return updated;
                });
                // Clear any stale unified_test_case data to prevent confusion
                localStorage.removeItem('unified_test_case');
                localStorage.removeItem('unified_test_case_timestamp');
                setShowCreateTestDialog(false);
                toast.success('Test case created');
                // Navigate to builder with the new test case
                navigate(`/test-cases/builder?testCaseId=${newTestCase.id}`);
              }}
              disabled={!newTestName.trim()}
              className="bg-amber-500 hover:bg-amber-400"
            >
              Create & Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Test Dialog - Add to existing run or create new */}
      <Dialog open={showRunTestDialog} onOpenChange={setShowRunTestDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Run Test Case</DialogTitle>
          </DialogHeader>
          {testCaseToRun && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                How would you like to run <strong className="text-white">{testCaseToRun.name}</strong>?
              </p>
              
              {/* Quick Run Option - Actually executes */}
              <button
                onClick={() => {
                  // Create run record and navigate to builder to execute
                  const runId = `run_${Date.now()}`;
                  const newRun: TestRun = {
                    id: runId,
                    name: `Quick Run: ${testCaseToRun.name}`,
                    testCaseId: testCaseToRun.id,
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
                  // Navigate to builder with autoRun to actually execute
                  navigate(`/test-cases/builder?testCaseId=${testCaseToRun.id}&autoRun=true&runId=${runId}`);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-green-500/50 hover:bg-green-900/20 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-green-600">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Quick Run (Execute Now)</p>
                  <p className="text-xs text-gray-500">Opens builder and runs test immediately</p>
                </div>
              </button>
              
              {/* Debug Option */}
              <button
                onClick={() => {
                  navigate(`/test-cases/builder?testCaseId=${testCaseToRun.id}`);
                  setShowRunTestDialog(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-amber-500/50 hover:bg-gray-800 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-blue-600">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Open in Builder</p>
                  <p className="text-xs text-gray-500">Edit steps, then run manually when ready</p>
                </div>
              </button>

              {/* Add to Test Run */}
              <button
                onClick={() => {
                  setShowRunTestDialog(false);
                  // Pre-select this test case for the new run dialog
                  setNewRunTestCases([testCaseToRun.id]);
                  setNewRunName(`Test Run: ${testCaseToRun.name}`);
                  setShowCreateRunDialog(true);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-purple-500/50 hover:bg-purple-900/20 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-purple-600">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Add to Test Run</p>
                  <p className="text-xs text-gray-500">Create or add to a formal test run with more cases</p>
                </div>
              </button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunTestDialog(false)} className="border-gray-700">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Test Run Dialog */}
      <Dialog open={showCreateRunDialog} onOpenChange={setShowCreateRunDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Test Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Run Name *</label>
              <Input
                value={newRunName}
                onChange={(e) => setNewRunName(e.target.value)}
                placeholder="e.g., Smoke Test - Sprint 1"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Test Mode</label>
                <select
                  value={newRunMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'automated' | 'manual';
                    setNewRunMode(mode);
                    // Reset to sequential for manual mode
                    if (mode === 'manual') {
                      setNewRunExecutionMode('sequential');
                    }
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="automated">Automated (Playwright)</option>
                  <option value="manual">Manual (Step-by-Step)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Execution Order</label>
                <select
                  value={newRunExecutionMode}
                  onChange={(e) => setNewRunExecutionMode(e.target.value as any)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                  disabled={newRunMode === 'manual'} // No parallel for manual
                >
                  <option value="sequential">Sequential (one by one)</option>
                  {newRunMode === 'automated' && (
                    <option value="parallel">Parallel (all at once)</option>
                  )}
                </select>
                {newRunMode === 'manual' && (
                  <p className="text-xs text-gray-500 mt-1">Manual tests run sequentially</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Link to Release</label>
                <select
                  value={newRunReleaseId}
                  onChange={(e) => setNewRunReleaseId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="">No Release</option>
                  {releases.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {newRunExecutionMode === 'parallel' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400">
                <strong>Note:</strong> Parallel execution runs tests in headless mode. 
                Best for independent tests that don't share state.
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Select Test Cases ({newRunTestCases.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-2 space-y-1">
                {testCases.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No test cases available</p>
                ) : (
                  testCases.map((tc) => (
                    <label
                      key={tc.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                        newRunTestCases.includes(tc.id) 
                          ? "bg-amber-500/10 border border-amber-500/30" 
                          : "hover:bg-gray-700"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={newRunTestCases.includes(tc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRunTestCases(prev => [...prev, tc.id]);
                          } else {
                            setNewRunTestCases(prev => prev.filter(id => id !== tc.id));
                          }
                        }}
                        className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{tc.name}</p>
                        <p className="text-xs text-gray-500">{tc.priority} • {tc.automationStatus || 'manual'}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700"
                  onClick={() => setNewRunTestCases(testCases.map(tc => tc.id))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700"
                  onClick={() => setNewRunTestCases([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateRunDialog(false);
              setNewRunName('');
              setNewRunTestCases([]);
              setNewRunReleaseId('');
              setNewRunExecutionMode('sequential');
              setNewRunMode('automated');
            }} className="border-gray-700">
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                if (!newRunName.trim()) {
                  toast.error('Run name is required');
                  return;
                }
                if (newRunTestCases.length === 0) {
                  toast.error('Select at least one test case');
                  return;
                }
                // Create run as pending (not executed yet)
                const newRun: TestRun = {
                  id: `run_${Date.now()}`,
                  name: newRunName.trim(),
                  mode: newRunMode,
                  executionMode: newRunExecutionMode,
                  releaseId: newRunReleaseId || undefined,
                  testCaseIds: newRunTestCases, // All test cases
                  testCaseId: newRunTestCases[0], // First test case (legacy)
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
                setNewRunName('');
                setNewRunTestCases([]);
                setNewRunReleaseId('');
                setNewRunExecutionMode('sequential');
                setNewRunMode('automated'); // Reset to default
                toast.success(`Test run created with ${newRunTestCases.length} test(s)`);
              }}
              className="border-gray-700"
            >
              Save (Run Later)
            </Button>
            <Button 
              onClick={async () => {
                if (!newRunName.trim()) {
                  toast.error('Run name is required');
                  return;
                }
                if (newRunTestCases.length === 0) {
                  toast.error('Select at least one test case');
                  return;
                }
                
                // Create run with all test cases
                const runId = `run_${Date.now()}`;
                const newRun: TestRun = {
                  id: runId,
                  name: newRunName.trim(),
                  mode: newRunMode,
                  executionMode: newRunExecutionMode,
                  releaseId: newRunReleaseId || undefined,
                  testCaseIds: newRunTestCases, // All test cases
                  testCaseId: newRunTestCases[0], // First test case (legacy)
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
                const runMode = newRunMode; // manual or automated
                
                setShowCreateRunDialog(false);
                setNewRunName('');
                setNewRunTestCases([]);
                setNewRunReleaseId('');
                setNewRunExecutionMode('sequential');
                setNewRunMode('automated'); // Reset to default
                
                // Manual mode: Navigate to step-level execution
                if (runMode === 'manual') {
                  toast.success(`Starting manual test execution for ${testsToRun.length} test(s)...`);
                  navigate(`/execution/run/${runId}/${testsToRun[0]}`);
                  return;
                }
                
                // Automated mode: Execute via Playwright in Electron
                if (isElectron()) {
                  toast.success(`Executing ${testsToRun.length} test(s) in ${execMode} mode...`);
                  if (testsToRun.length === 1) {
                    // Single test - use simple executor
                    await executeTestDirectly(testsToRun[0], runId);
                  } else {
                    // Multiple tests - use multi-test executor
                    await executeMultipleTests(testsToRun, runId, execMode);
                  }
                } else {
                  // Navigate to builder to execute first test (web mode)
                  navigate(`/test-cases/builder?testCaseId=${testsToRun[0]}&autoRun=true&runId=${runId}`);
                  toast.info('Note: Multiple tests will run one at a time in web mode');
                }
              }}
              className={cn(
                newRunMode === 'manual' ? "bg-amber-600 hover:bg-amber-500" : "bg-green-600 hover:bg-green-500"
              )}
              disabled={newRunMode === 'automated' && executingRunId !== null}
            >
              <Play className="w-4 h-4 mr-1" />
              {newRunMode === 'manual'
                ? 'Start Manual Execution'
                : newRunTestCases.length > 1 
                  ? `Run ${newRunTestCases.length} Tests (${newRunExecutionMode})`
                  : 'Create & Run Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Test Case Configuration Dialog */}
      <Dialog open={showEditTestConfigDialog} onOpenChange={setShowEditTestConfigDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Test Case Configuration</DialogTitle>
          </DialogHeader>
          {editingTestCase && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Test Name *</label>
                <Input
                  value={editingTestCase.name}
                  onChange={(e) => setEditingTestCase({ ...editingTestCase, name: e.target.value })}
                  placeholder="Test case name"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <Input
                  value={editingTestCase.description || ''}
                  onChange={(e) => setEditingTestCase({ ...editingTestCase, description: e.target.value })}
                  placeholder="Brief description"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Priority</label>
                  <select
                    value={editingTestCase.priority || 'medium'}
                    onChange={(e) => setEditingTestCase({ ...editingTestCase, priority: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Status</label>
                  <select
                    value={editingTestCase.status || 'draft'}
                    onChange={(e) => setEditingTestCase({ ...editingTestCase, status: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="approved">Approved</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Folder</label>
                <select
                  value={editingTestCase.folderId || 'root'}
                  onChange={(e) => setEditingTestCase({ ...editingTestCase, folderId: e.target.value === 'root' ? null : e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="root">Test Repository (Root)</option>
                  {folders.filter(f => f.id !== 'root').map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Tags (comma separated)</label>
                <Input
                  value={editingTestCase.tags?.join(', ') || ''}
                  onChange={(e) => setEditingTestCase({ 
                    ...editingTestCase, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                  })}
                  placeholder="e.g., smoke, regression, login"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                handleEditTest(editingTestCase!);
                setShowEditTestConfigDialog(false);
              }} 
              className="border-gray-700 mr-auto"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit Steps
            </Button>
            <Button variant="outline" onClick={() => setShowEditTestConfigDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!editingTestCase?.name?.trim()) {
                  toast.error('Test name is required');
                  return;
                }
                setTestCases(prev => {
                  const updated = prev.map(tc => 
                    tc.id === editingTestCase.id 
                      ? { ...editingTestCase, updatedAt: new Date().toISOString() } 
                      : tc
                  );
                  localStorage.setItem('test_cases', JSON.stringify(updated));
                  return updated;
                });
                setShowEditTestConfigDialog(false);
                setEditingTestCase(null);
                toast.success('Test case updated');
              }}
              className="bg-amber-500 hover:bg-amber-400"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Run Results Dialog */}
      <TestRunResultsDialog
        open={showResultsDialog}
        onClose={() => {
          setShowResultsDialog(false);
          setSelectedRunForResults(null);
        }}
        run={selectedRunForResults}
        testCase={selectedRunForResults?.testCaseId 
          ? testCases.find(tc => tc.id === selectedRunForResults.testCaseId) || null 
          : null}
        testCases={testCases}
        onRerun={selectedRunForResults?.testCaseId ? async () => {
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
      />
    </div>
  );
}

