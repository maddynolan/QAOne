/**
 * RepositoryDialogs - All dialog modals used by TestRepository.
 * Extracted to reduce TestRepository.tsx size. Contains:
 * - Edit Suite, Edit Release, Edit Plan dialogs
 * - Create Suite, Create Release, Create Test Case dialogs
 * - Run Test, Create Test Run, Run Details dialogs
 * - Link Plan to Release, Edit Test Config dialogs
 */
import React from 'react';
import {
  Play, Edit, Trash2, Plus, Search, CheckCircle, AlertCircle, Clock,
  Target, Rocket, BarChart3, Pencil, Zap, Bug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  TestSuite, Release, TestPlan, TestRun, TestCase, TestFolder,
} from '../types/test-repository.types';
import { CreateDefectForm } from './CreateDefectForm';
import { TestRunResultsDialog } from './TestRunResultsDialog';
import type { Defect } from '../types/test-repository.types';
import type { ApiRunResult } from '../lib/test-repository-api';

export interface RepositoryDialogsProps {
  // -- Edit Suite --
  showEditSuiteDialog: boolean;
  setShowEditSuiteDialog: (v: boolean) => void;
  editingSuite: TestSuite | null;
  setEditingSuite: (v: TestSuite | null) => void;
  handleSaveSuite: () => void;

  // -- Edit Release --
  showEditReleaseDialog: boolean;
  setShowEditReleaseDialog: (v: boolean) => void;
  editingRelease: Release | null;
  setEditingRelease: (v: Release | null) => void;
  handleSaveRelease: () => void;
  suites: TestSuite[];
  testPlans: TestPlan[];

  // -- Create Suite --
  showCreateSuiteDialog: boolean;
  setShowCreateSuiteDialog: (v: boolean) => void;
  newSuiteName: string;
  setNewSuiteName: (v: string) => void;
  newSuiteDescription: string;
  setNewSuiteDescription: (v: string) => void;
  newSuiteTestCases: string[];
  setNewSuiteTestCases: React.Dispatch<React.SetStateAction<string[]>>;
  testCases: TestCase[];
  handleCreateSuite: () => void;

  // -- Create Release --
  showCreateReleaseDialog: boolean;
  setShowCreateReleaseDialog: (v: boolean) => void;
  newReleaseName: string;
  setNewReleaseName: (v: string) => void;
  newReleaseDescription: string;
  setNewReleaseDescription: (v: string) => void;
  newReleaseStartDate: string;
  setNewReleaseStartDate: (v: string) => void;
  newReleaseEndDate: string;
  setNewReleaseEndDate: (v: string) => void;
  newReleaseSuites: string[];
  setNewReleaseSuites: React.Dispatch<React.SetStateAction<string[]>>;
  handleCreateRelease: () => void;

  // -- Edit Plan --
  showEditPlanDialog: boolean;
  setShowEditPlanDialog: (v: boolean) => void;
  editingPlan: TestPlan | null;
  setEditingPlan: (v: TestPlan | null) => void;
  onSavePlan: () => void;

  // -- Link Plan to Release --
  showLinkPlanToReleaseDialog: boolean;
  setShowLinkPlanToReleaseDialog: (v: boolean) => void;
  releases: Release[];
  onLinkPlanToRelease: (releaseId: string) => void;
  onUnlinkPlanFromRelease: () => void;

  // -- Run Details --
  showRunDetailsDialog: boolean;
  setShowRunDetailsDialog: (v: boolean) => void;
  selectedRun: TestRun | null;
  onRerunFromDetails: () => void;

  // -- Create Test Case --
  showCreateTestDialog: boolean;
  setShowCreateTestDialog: (v: boolean) => void;
  newTestName: string;
  setNewTestName: (v: string) => void;
  newTestDescription: string;
  setNewTestDescription: (v: string) => void;
  newTestPriority: 'critical' | 'high' | 'medium' | 'low';
  setNewTestPriority: (v: 'critical' | 'high' | 'medium' | 'low') => void;
  newTestFolder: string;
  setNewTestFolder: (v: string) => void;
  folders: TestFolder[];
  onCreateTestCase: () => void;

  // -- Run Test Dialog --
  showRunTestDialog: boolean;
  setShowRunTestDialog: (v: boolean) => void;
  testCaseToRun: TestCase | null;
  isApiTest: (tc: TestCase) => boolean;
  runApiTestFromRepository: (tc: TestCase) => Promise<void>;
  apiRunResult: ApiRunResult | null;
  onQuickRunTest: (tc: TestCase) => void;
  onOpenInBuilder: (tc: TestCase) => void;
  onOpenInApiTesting: () => void;
  onAddToTestRun: (tc: TestCase) => void;

  // -- Create Test Run --
  showCreateRunDialog: boolean;
  setShowCreateRunDialog: (v: boolean) => void;
  newRunName: string;
  setNewRunName: (v: string) => void;
  newRunMode: 'automated' | 'manual';
  setNewRunMode: (v: 'automated' | 'manual') => void;
  newRunExecutionMode: 'sequential' | 'parallel';
  setNewRunExecutionMode: (v: 'sequential' | 'parallel') => void;
  newRunReleaseId: string;
  setNewRunReleaseId: (v: string) => void;
  newRunTestCases: string[];
  setNewRunTestCases: React.Dispatch<React.SetStateAction<string[]>>;
  newRunTestSearch: string;
  setNewRunTestSearch: (v: string) => void;
  executingRunId: string | null;
  onCreateRunSaveLater: () => void;
  onCreateRunAndExecute: () => void;

  // -- Edit Test Config --
  showEditTestConfigDialog: boolean;
  setShowEditTestConfigDialog: (v: boolean) => void;
  editingTestCase: TestCase | null;
  setEditingTestCase: (v: TestCase | null) => void;
  handleEditTest: (tc: TestCase) => void;
  onSaveTestConfig: () => void;

  // -- Test Run Results --
  showResultsDialog: boolean;
  selectedRunForResults: TestRun | null;
  onCloseResults: () => void;
  onRerunFromResults: (() => Promise<void>) | undefined;

  // -- Defect dialogs --
  showCreateDefectDialog: boolean;
  setShowCreateDefectDialog: (v: boolean) => void;
  showEditDefectDialog: boolean;
  setShowEditDefectDialog: (v: boolean) => void;
  editingDefect: Defect | null;
  setEditingDefect: (v: Defect | null) => void;
  testRuns: TestRun[];
  onCreateDefect: (defect: Defect) => void;
  onUpdateDefect: (defect: Defect) => void;
}

export function RepositoryDialogs(props: RepositoryDialogsProps) {
  const {
    showEditSuiteDialog, setShowEditSuiteDialog, editingSuite, setEditingSuite, handleSaveSuite,
    showEditReleaseDialog, setShowEditReleaseDialog, editingRelease, setEditingRelease, handleSaveRelease,
    suites, testPlans,
    showCreateSuiteDialog, setShowCreateSuiteDialog, newSuiteName, setNewSuiteName,
    newSuiteDescription, setNewSuiteDescription, newSuiteTestCases, setNewSuiteTestCases,
    testCases, handleCreateSuite,
    showCreateReleaseDialog, setShowCreateReleaseDialog, newReleaseName, setNewReleaseName,
    newReleaseDescription, setNewReleaseDescription, newReleaseStartDate, setNewReleaseStartDate,
    newReleaseEndDate, setNewReleaseEndDate, newReleaseSuites, setNewReleaseSuites, handleCreateRelease,
    showEditPlanDialog, setShowEditPlanDialog, editingPlan, setEditingPlan, onSavePlan,
    showLinkPlanToReleaseDialog, setShowLinkPlanToReleaseDialog, releases,
    onLinkPlanToRelease, onUnlinkPlanFromRelease,
    showRunDetailsDialog, setShowRunDetailsDialog, selectedRun, onRerunFromDetails,
    showCreateTestDialog, setShowCreateTestDialog, newTestName, setNewTestName,
    newTestDescription, setNewTestDescription, newTestPriority, setNewTestPriority,
    newTestFolder, setNewTestFolder, folders, onCreateTestCase,
    showRunTestDialog, setShowRunTestDialog, testCaseToRun, isApiTest,
    runApiTestFromRepository, apiRunResult, onQuickRunTest, onOpenInBuilder,
    onOpenInApiTesting, onAddToTestRun,
    showCreateRunDialog, setShowCreateRunDialog, newRunName, setNewRunName,
    newRunMode, setNewRunMode, newRunExecutionMode, setNewRunExecutionMode,
    newRunReleaseId, setNewRunReleaseId, newRunTestCases, setNewRunTestCases,
    newRunTestSearch, setNewRunTestSearch, executingRunId,
    onCreateRunSaveLater, onCreateRunAndExecute,
    showEditTestConfigDialog, setShowEditTestConfigDialog, editingTestCase, setEditingTestCase,
    handleEditTest, onSaveTestConfig,
    showResultsDialog, selectedRunForResults, onCloseResults, onRerunFromResults,
    showCreateDefectDialog, setShowCreateDefectDialog,
    showEditDefectDialog, setShowEditDefectDialog, editingDefect, setEditingDefect,
    testRuns, onCreateDefect, onUpdateDefect,
  } = props;

  return (
    <>
      {/* Edit Suite Dialog */}
      <Dialog open={showEditSuiteDialog} onOpenChange={setShowEditSuiteDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Test Suite</DialogTitle>
          </DialogHeader>
          {editingSuite && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Suite Name</label>
                <Input
                  value={editingSuite.name}
                  onChange={(e) => setEditingSuite({ ...editingSuite, name: e.target.value })}
                  placeholder="Enter suite name"
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                <Input
                  value={editingSuite.description || ''}
                  onChange={(e) => setEditingSuite({ ...editingSuite, description: e.target.value })}
                  placeholder="Enter description"
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Schedule</label>
                <select
                  value={editingSuite.schedule || 'on-demand'}
                  onChange={(e) => setEditingSuite({ ...editingSuite, schedule: e.target.value as TestSuite['schedule'] })}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"
                >
                  <option value="on-demand">On Demand</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSuiteDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={handleSaveSuite} className="bg-amber-500 hover:bg-amber-400">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Release Dialog */}
      <Dialog open={showEditReleaseDialog} onOpenChange={setShowEditReleaseDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Release</DialogTitle></DialogHeader>
          {editingRelease && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Release Name</label>
                <Input value={editingRelease.name} onChange={(e) => setEditingRelease({ ...editingRelease, name: e.target.value })} placeholder="Enter release name" className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                <Input value={editingRelease.description || ''} onChange={(e) => setEditingRelease({ ...editingRelease, description: e.target.value })} placeholder="Enter description" className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Start Date</label>
                  <Input type="date" value={editingRelease.startDate?.split('T')[0] || ''} onChange={(e) => setEditingRelease({ ...editingRelease, startDate: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">End Date</label>
                  <Input type="date" value={editingRelease.endDate?.split('T')[0] || ''} onChange={(e) => setEditingRelease({ ...editingRelease, endDate: e.target.value })} className="bg-secondary border-border" />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                <select value={editingRelease.status} onChange={(e) => setEditingRelease({ ...editingRelease, status: e.target.value as Release['status'] })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground">
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Link Test Suites ({editingRelease.suiteIds?.length || 0} selected)</label>
                <div className="max-h-32 overflow-y-auto border border-border rounded-md bg-secondary p-2 space-y-1">
                  {suites.length === 0 ? <p className="text-muted-foreground text-sm text-center py-2">No test suites available</p> : suites.map((suite) => (
                    <label key={suite.id} className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", editingRelease.suiteIds?.includes(suite.id) ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-secondary")}>
                      <input type="checkbox" checked={editingRelease.suiteIds?.includes(suite.id) || false} onChange={(e) => { const ids = editingRelease.suiteIds || []; setEditingRelease({ ...editingRelease, suiteIds: e.target.checked ? [...ids, suite.id] : ids.filter(id => id !== suite.id) }); }} className="rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500" />
                      <span className="text-sm text-foreground truncate">{suite.name}</span>
                      <span className="text-xs text-muted-foreground">({suite.testCaseIds.length} tests)</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Link Test Plans ({editingRelease.planIds?.length || 0} selected)</label>
                <div className="max-h-32 overflow-y-auto border border-border rounded-md bg-secondary p-2 space-y-1">
                  {testPlans.length === 0 ? <p className="text-muted-foreground text-sm text-center py-2">No test plans available</p> : testPlans.map((plan) => (
                    <label key={plan.id} className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", editingRelease.planIds?.includes(plan.id) ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-secondary")}>
                      <input type="checkbox" checked={editingRelease.planIds?.includes(plan.id) || false} onChange={(e) => { const ids = editingRelease.planIds || []; setEditingRelease({ ...editingRelease, planIds: e.target.checked ? [...ids, plan.id] : ids.filter(id => id !== plan.id) }); }} className="rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500" />
                      <span className="text-sm text-foreground truncate">{plan.name}</span>
                      <Badge className="text-[10px] bg-secondary">{plan.status}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditReleaseDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={handleSaveRelease} className="bg-amber-500 hover:bg-amber-400">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Suite Dialog */}
      <Dialog open={showCreateSuiteDialog} onOpenChange={setShowCreateSuiteDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Test Suite</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Suite Name *</label>
              <Input value={newSuiteName} onChange={(e) => setNewSuiteName(e.target.value)} placeholder="e.g., Login Flow Tests, Checkout Regression" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Description</label>
              <Input value={newSuiteDescription} onChange={(e) => setNewSuiteDescription(e.target.value)} placeholder="Brief description of this test suite" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Link Test Cases ({newSuiteTestCases.length} selected)</label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-secondary p-2 space-y-1">
                {testCases.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No test cases available</p> : testCases.map((tc) => (
                  <label key={tc.id} className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", newSuiteTestCases.includes(tc.id) ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-secondary")}>
                    <input type="checkbox" checked={newSuiteTestCases.includes(tc.id)} onChange={(e) => { if (e.target.checked) setNewSuiteTestCases(prev => [...prev, tc.id]); else setNewSuiteTestCases(prev => prev.filter(id => id !== tc.id)); }} className="rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tc.name}</p>
                      <p className="text-xs text-muted-foreground">{tc.priority || 'No priority'} &bull; {tc.automationStatus || 'none'}</p>
                    </div>
                    {tc.lastResult && <Badge className={cn("text-xs", tc.lastResult === 'passed' ? "bg-green-500/10 text-green-400" : tc.lastResult === 'failed' ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-muted-foreground")}>{tc.lastResult}</Badge>}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" className="text-xs border-border" onClick={() => setNewSuiteTestCases(testCases.map(tc => tc.id))}>Select All</Button>
                <Button variant="outline" size="sm" className="text-xs border-border" onClick={() => setNewSuiteTestCases([])}>Clear</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSuiteDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={handleCreateSuite} className="bg-amber-500 hover:bg-amber-400">Create Suite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Release Dialog */}
      <Dialog open={showCreateReleaseDialog} onOpenChange={setShowCreateReleaseDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Release</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Release Name *</label>
              <Input value={newReleaseName} onChange={(e) => setNewReleaseName(e.target.value)} placeholder="e.g., Sprint 1.0, Q1 2024 Release" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Description</label>
              <Input value={newReleaseDescription} onChange={(e) => setNewReleaseDescription(e.target.value)} placeholder="Brief description of this release" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Start Date</label>
                <Input type="date" value={newReleaseStartDate} onChange={(e) => setNewReleaseStartDate(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">End Date</label>
                <Input type="date" value={newReleaseEndDate} onChange={(e) => setNewReleaseEndDate(e.target.value)} className="bg-secondary border-border" />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Link Test Suites ({newReleaseSuites.length} selected)</label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-secondary p-2 space-y-1">
                {suites.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No test suites available. Create suites first.</p> : suites.map((suite) => (
                  <label key={suite.id} className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", newReleaseSuites.includes(suite.id) ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-secondary")}>
                    <input type="checkbox" checked={newReleaseSuites.includes(suite.id)} onChange={(e) => { if (e.target.checked) setNewReleaseSuites(prev => [...prev, suite.id]); else setNewReleaseSuites(prev => prev.filter(id => id !== suite.id)); }} className="rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{suite.name}</p>
                      <p className="text-xs text-muted-foreground">{suite.testCaseIds.length} test cases &bull; {suite.schedule || 'on-demand'}</p>
                    </div>
                    {suite.lastRun && <div className="text-xs text-muted-foreground"><span className="text-green-400">{suite.lastRun.passed}&#10003;</span><span className="text-red-400 ml-1">{suite.lastRun.failed}&#10007;</span></div>}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" className="text-xs border-border" onClick={() => setNewReleaseSuites(suites.map(s => s.id))}>Select All</Button>
                <Button variant="outline" size="sm" className="text-xs border-border" onClick={() => setNewReleaseSuites([])}>Clear</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateReleaseDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={handleCreateRelease} className="bg-amber-500 hover:bg-amber-400">Create Release</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={showEditPlanDialog} onOpenChange={setShowEditPlanDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Test Plan</DialogTitle></DialogHeader>
          {editingPlan && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Plan Name *</label>
                <Input value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} placeholder="Enter plan name" className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                <Input value={editingPlan.description || ''} onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })} placeholder="Enter description" className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                  <select value={editingPlan.status} onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.value as TestPlan['status'] })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground">
                    <option value="draft">Draft</option><option value="ready">Ready</option><option value="in-progress">In Progress</option><option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Environment</label>
                  <Input value={editingPlan.environment || ''} onChange={(e) => setEditingPlan({ ...editingPlan, environment: e.target.value })} placeholder="e.g., QA, Staging, Prod" className="bg-secondary border-border" />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Link Test Suites ({editingPlan.suiteIds.length} selected)</label>
                <div className="max-h-40 overflow-y-auto border border-border rounded-md bg-secondary p-2 space-y-1">
                  {suites.length === 0 ? <p className="text-muted-foreground text-sm text-center py-2">No test suites available</p> : suites.map((suite) => (
                    <label key={suite.id} className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", editingPlan.suiteIds.includes(suite.id) ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-secondary")}>
                      <input type="checkbox" checked={editingPlan.suiteIds.includes(suite.id)} onChange={(e) => { if (e.target.checked) setEditingPlan({ ...editingPlan, suiteIds: [...editingPlan.suiteIds, suite.id] }); else setEditingPlan({ ...editingPlan, suiteIds: editingPlan.suiteIds.filter(id => id !== suite.id) }); }} className="rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{suite.name}</p><p className="text-xs text-muted-foreground">{suite.testCaseIds.length} test cases</p></div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Link Individual Test Cases ({editingPlan.testCaseIds.length} selected)</label>
                <div className="max-h-40 overflow-y-auto border border-border rounded-md bg-secondary p-2 space-y-1">
                  {testCases.length === 0 ? <p className="text-muted-foreground text-sm text-center py-2">No test cases available</p> : testCases.slice(0, 50).map((tc) => (
                    <label key={tc.id} className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", editingPlan.testCaseIds.includes(tc.id) ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-secondary")}>
                      <input type="checkbox" checked={editingPlan.testCaseIds.includes(tc.id)} onChange={(e) => { if (e.target.checked) setEditingPlan({ ...editingPlan, testCaseIds: [...editingPlan.testCaseIds, tc.id] }); else setEditingPlan({ ...editingPlan, testCaseIds: editingPlan.testCaseIds.filter(id => id !== tc.id) }); }} className="rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500" />
                      <span className="text-sm text-foreground truncate">{tc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPlanDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={onSavePlan} className="bg-amber-500 hover:bg-amber-400">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Details Dialog */}
      <Dialog open={showRunDetailsDialog} onOpenChange={setShowRunDetailsDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Test Run Details</DialogTitle></DialogHeader>
          {selectedRun && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {selectedRun.status === 'passed' && <CheckCircle className="w-8 h-8 text-green-500" />}
                {selectedRun.status === 'failed' && <AlertCircle className="w-8 h-8 text-red-500" />}
                {selectedRun.status === 'running' && <Clock className="w-8 h-8 text-blue-600 dark:text-primary animate-pulse" />}
                {selectedRun.status === 'pending' && <Clock className="w-8 h-8 text-gray-500" />}
                {selectedRun.status === 'blocked' && <AlertCircle className="w-8 h-8 text-yellow-500" />}
                <div><h3 className="font-semibold text-lg">{selectedRun.name}</h3><p className="text-sm text-muted-foreground">{selectedRun.mode} execution</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary rounded-lg">
                <div><p className="text-xs text-muted-foreground mb-1">Status</p><Badge className={cn(selectedRun.status === 'passed' && "bg-green-500/10 text-green-400", selectedRun.status === 'failed' && "bg-red-500/10 text-red-400", selectedRun.status === 'running' && "bg-amber-500/10 text-blue-600 dark:text-primary", selectedRun.status === 'pending' && "bg-gray-500/10 text-muted-foreground", selectedRun.status === 'blocked' && "bg-yellow-500/10 text-yellow-400")}>{selectedRun.status}</Badge></div>
                <div><p className="text-xs text-muted-foreground mb-1">Mode</p><Badge className={cn(selectedRun.mode === 'automated' ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-blue-600 dark:text-primary")}>{selectedRun.mode}</Badge></div>
                <div><p className="text-xs text-muted-foreground mb-1">Started</p><p className="text-sm">{new Date(selectedRun.startTime).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">Ended</p><p className="text-sm">{selectedRun.endTime ? new Date(selectedRun.endTime).toLocaleString() : 'In progress'}</p></div>
              </div>
              {selectedRun.results && (
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">Results</p>
                  <div className="flex items-center justify-around">
                    <div className="text-center"><p className="text-2xl font-bold text-green-400">{selectedRun.results.passed}</p><p className="text-xs text-muted-foreground">Passed</p></div>
                    <div className="text-center"><p className="text-2xl font-bold text-red-400">{selectedRun.results.failed}</p><p className="text-xs text-muted-foreground">Failed</p></div>
                    <div className="text-center"><p className="text-2xl font-bold text-muted-foreground">{selectedRun.results.skipped}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
                  </div>
                </div>
              )}
              {selectedRun.planId && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="w-4 h-4" />Plan: {testPlans.find(p => p.id === selectedRun.planId)?.name || 'Unknown'}</div>}
              {selectedRun.releaseId && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Rocket className="w-4 h-4" />Release: {releases.find(r => r.id === selectedRun.releaseId)?.name || 'Unknown'}</div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunDetailsDialog(false)} className="border-border">Close</Button>
            {selectedRun && selectedRun.status !== 'running' && (
              <Button onClick={onRerunFromDetails} className="bg-green-600 hover:bg-green-500"><Play className="w-4 h-4 mr-1" />Re-run</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Plan to Release Dialog */}
      <Dialog open={showLinkPlanToReleaseDialog} onOpenChange={setShowLinkPlanToReleaseDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Link Plan to Release</DialogTitle></DialogHeader>
          {editingPlan && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select a release to link <strong>{editingPlan.name}</strong> to:</p>
              <div className="space-y-2">
                {releases.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No releases available. Create a release first.</p> : releases.map((release) => (
                  <button key={release.id} onClick={() => onLinkPlanToRelease(release.id)} className={cn("w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left", editingPlan.releaseId === release.id ? "bg-primary/10 border-primary/30" : "bg-secondary border-border hover:border-blue-500/50 dark:hover:border-amber-500/30")}>
                    <Rocket className="w-5 h-5 text-purple-400" />
                    <div className="flex-1"><p className="font-medium text-gray-900 dark:text-white">{release.name}</p><p className="text-xs text-muted-foreground">{release.status} &bull; {release.suiteIds.length} suites</p></div>
                    {editingPlan.releaseId === release.id && <CheckCircle className="w-5 h-5 text-blue-600 dark:text-primary" />}
                  </button>
                ))}
              </div>
              {editingPlan.releaseId && <Button variant="outline" size="sm" className="w-full border-border text-muted-foreground" onClick={onUnlinkPlanFromRelease}>Remove Link</Button>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkPlanToReleaseDialog(false)} className="border-border">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Test Case Dialog */}
      <Dialog open={showCreateTestDialog} onOpenChange={setShowCreateTestDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Create Test Case</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm text-muted-foreground mb-1 block">Test Name *</label><Input value={newTestName} onChange={(e) => setNewTestName(e.target.value)} placeholder="e.g., User Login with Valid Credentials" className="bg-secondary border-border" autoFocus /></div>
            <div><label className="text-sm text-muted-foreground mb-1 block">Description</label><Input value={newTestDescription} onChange={(e) => setNewTestDescription(e.target.value)} placeholder="Brief description of what this test validates" className="bg-secondary border-border" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground mb-1 block">Priority</label><select value={newTestPriority} onChange={(e) => setNewTestPriority(e.target.value as TestCase['priority'])} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
              <div><label className="text-sm text-muted-foreground mb-1 block">Folder</label><select value={newTestFolder} onChange={(e) => setNewTestFolder(e.target.value)} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"><option value="root">Test Repository (Root)</option>{folders.filter(f => f.id !== 'root').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTestDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={onCreateTestCase} disabled={!newTestName.trim()} className="bg-amber-500 hover:bg-amber-400">Create &amp; Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Test Dialog */}
      <Dialog open={showRunTestDialog} onOpenChange={setShowRunTestDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Run Test Case</DialogTitle></DialogHeader>
          {testCaseToRun && (() => {
            const apiTest = isApiTest(testCaseToRun);
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">How would you like to run <strong className="text-gray-900 dark:text-white">{testCaseToRun.name}</strong>?</p>
                {apiTest && <Badge variant="secondary" className="text-xs">API test -- runs via API Testing engine</Badge>}
                {apiTest ? (
                  <button onClick={async () => { await runApiTestFromRepository(testCaseToRun); }} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary hover:border-green-500/50 hover:bg-green-900/20 transition-all text-left">
                    <div className="p-2 rounded-lg bg-green-600"><Play className="w-5 h-5 text-white" /></div>
                    <div className="flex-1"><p className="font-medium text-foreground">Quick Run (Execute Now)</p><p className="text-xs text-muted-foreground">Runs this API test and shows result here</p></div>
                  </button>
                ) : (
                  <button onClick={() => onQuickRunTest(testCaseToRun)} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary hover:border-green-500/50 hover:bg-green-900/20 transition-all text-left">
                    <div className="p-2 rounded-lg bg-green-600"><Play className="w-5 h-5 text-white" /></div>
                    <div className="flex-1"><p className="font-medium text-foreground">Quick Run (Execute Now)</p><p className="text-xs text-muted-foreground">Opens builder and runs test immediately</p></div>
                  </button>
                )}
                {apiRunResult && (
                  <div className={cn('rounded-lg border p-3 text-sm', apiRunResult.passed ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10')}>
                    <p className="font-medium">{apiRunResult.passed ? 'Passed' : 'Failed'}</p>
                    <p className="text-muted-foreground">{apiRunResult.message}</p>
                    {apiRunResult.detail && <pre className="mt-1 text-xs overflow-auto max-h-20">{apiRunResult.detail}</pre>}
                  </div>
                )}
                <button onClick={() => onOpenInBuilder(testCaseToRun)} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary hover:border-amber-500/50 hover:bg-accent transition-all text-left">
                  <div className="p-2 rounded-lg bg-blue-600"><Pencil className="w-5 h-5 text-white" /></div>
                  <div className="flex-1"><p className="font-medium text-foreground">Open in Builder</p><p className="text-xs text-muted-foreground">Edit steps in the visual builder, then run when ready</p></div>
                </button>
                {apiTest && (
                  <button onClick={onOpenInApiTesting} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary hover:border-cyan-500/50 hover:bg-cyan-900/20 transition-all text-left">
                    <div className="p-2 rounded-lg bg-cyan-600"><Zap className="w-5 h-5 text-white" /></div>
                    <div className="flex-1"><p className="font-medium text-foreground">Open in API Testing</p><p className="text-xs text-muted-foreground">Edit request, assertions, and run in API tab</p></div>
                  </button>
                )}
                <button onClick={() => onAddToTestRun(testCaseToRun)} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary hover:border-purple-500/50 hover:bg-purple-900/20 transition-all text-left">
                  <div className="p-2 rounded-lg bg-purple-600"><Plus className="w-5 h-5 text-white" /></div>
                  <div className="flex-1"><p className="font-medium text-foreground">Add to Test Run</p><p className="text-xs text-muted-foreground">Create or add to a formal test run with more cases</p></div>
                </button>
              </div>
            );
          })()}
          <DialogFooter><Button variant="outline" onClick={() => setShowRunTestDialog(false)} className="border-border">Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Test Run Dialog */}
      <Dialog open={showCreateRunDialog} onOpenChange={setShowCreateRunDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Test Run</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm text-muted-foreground mb-1 block">Run Name *</label><Input value={newRunName} onChange={(e) => setNewRunName(e.target.value)} placeholder="e.g., Smoke Test - Sprint 1" className="bg-secondary border-border" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Test Mode</label>
                <select value={newRunMode} onChange={(e) => { const mode = e.target.value as 'automated' | 'manual'; setNewRunMode(mode); if (mode === 'manual') setNewRunExecutionMode('sequential'); }} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground">
                  <option value="automated">Automated</option><option value="manual">Manual (Step-by-Step)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Execution Order</label>
                <select value={newRunExecutionMode} onChange={(e) => setNewRunExecutionMode(e.target.value as 'sequential' | 'parallel')} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground" disabled={newRunMode === 'manual'}>
                  <option value="sequential">Sequential (one by one)</option>{newRunMode === 'automated' && <option value="parallel">Parallel (all at once)</option>}
                </select>
                {newRunMode === 'manual' && <p className="text-xs text-muted-foreground mt-1">Manual tests run sequentially</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Link to Release</label>
                <select value={newRunReleaseId} onChange={(e) => setNewRunReleaseId(e.target.value)} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground">
                  <option value="">No Release</option>{releases.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            {newRunExecutionMode === 'parallel' && <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-blue-600 dark:text-primary"><strong>Note:</strong> Parallel execution runs tests in headless mode. Best for independent tests that don&apos;t share state.</div>}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Select Test Cases ({newRunTestCases.length} selected)</label>
              <div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" /><Input value={newRunTestSearch} onChange={(e) => setNewRunTestSearch(e.target.value)} placeholder="Search by test ID or name..." className="pl-10 bg-secondary border-border" /></div>
              <div className="max-h-56 overflow-y-auto border border-border rounded-md bg-secondary p-2 space-y-1">
                {testCases.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No test cases available</p> : (() => {
                  const searchLower = newRunTestSearch.toLowerCase();
                  const filtered = searchLower ? testCases.filter(tc => tc.id.toLowerCase().includes(searchLower) || tc.name.toLowerCase().includes(searchLower)) : testCases.slice(0, 50);
                  if (filtered.length === 0) return <p className="text-muted-foreground text-sm text-center py-4">No test cases match &quot;{newRunTestSearch}&quot;</p>;
                  return filtered.map((tc) => (
                    <label key={tc.id} className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", newRunTestCases.includes(tc.id) ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-secondary")}>
                      <input type="checkbox" checked={newRunTestCases.includes(tc.id)} onChange={(e) => { if (e.target.checked) setNewRunTestCases(prev => [...prev, tc.id]); else setNewRunTestCases(prev => prev.filter(id => id !== tc.id)); }} className="rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><p className="text-sm font-medium text-foreground truncate">{tc.name}</p><code className="text-[10px] text-gray-500 bg-secondary px-1 rounded">{tc.id.slice(0, 8)}</code></div>
                        <p className="text-xs text-muted-foreground">{tc.priority || 'medium'} &bull; {tc.automationStatus || 'manual'}</p>
                      </div>
                    </label>
                  ));
                })()}
              </div>
              {testCases.length > 50 && !newRunTestSearch && <p className="text-xs text-muted-foreground mt-1">Showing first 50 tests. Use search to find more.</p>}
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" className="text-xs border-border" onClick={() => { const s = newRunTestSearch.toLowerCase(); const sel = s ? testCases.filter(tc => tc.id.toLowerCase().includes(s) || tc.name.toLowerCase().includes(s)) : testCases.slice(0, 50); setNewRunTestCases(sel.map(tc => tc.id)); }}>Select All Visible</Button>
                <Button variant="outline" size="sm" className="text-xs border-border" onClick={() => setNewRunTestCases([])}>Clear</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateRunDialog(false); setNewRunName(''); setNewRunTestCases([]); setNewRunReleaseId(''); setNewRunExecutionMode('sequential'); setNewRunMode('automated'); setNewRunTestSearch(''); }} className="border-border">Cancel</Button>
            <Button variant="outline" onClick={onCreateRunSaveLater} className="border-border">Save (Run Later)</Button>
            <Button onClick={onCreateRunAndExecute} className={cn(newRunMode === 'manual' ? "bg-primary hover:bg-primary/90" : "bg-green-600 hover:bg-green-500")} disabled={newRunMode === 'automated' && executingRunId !== null}>
              <Play className="w-4 h-4 mr-1" />{newRunMode === 'manual' ? 'Start Manual Execution' : newRunTestCases.length > 1 ? `Run ${newRunTestCases.length} Tests (${newRunExecutionMode})` : 'Create & Run Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Test Case Configuration Dialog */}
      <Dialog open={showEditTestConfigDialog} onOpenChange={setShowEditTestConfigDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Test Case Configuration</DialogTitle></DialogHeader>
          {editingTestCase && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Test Name *</label>
                <textarea value={editingTestCase.name} onChange={(e) => setEditingTestCase({ ...editingTestCase, name: e.target.value })} placeholder="Test case name" rows={2} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500" style={{ minHeight: '42px', maxHeight: '100px' }} />
                {editingTestCase.name?.length > 50 && <p className="text-xs text-blue-600 dark:text-primary mt-1">{editingTestCase.name.length} characters - Consider shortening for better readability</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                <textarea value={editingTestCase.description || ''} onChange={(e) => setEditingTestCase({ ...editingTestCase, description: e.target.value })} placeholder="Brief description of what this test case validates" rows={2} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-muted-foreground mb-1 block">Priority</label><select value={editingTestCase.priority || 'medium'} onChange={(e) => setEditingTestCase({ ...editingTestCase, priority: e.target.value as TestCase['priority'] })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
                <div><label className="text-sm text-muted-foreground mb-1 block">Status</label><select value={editingTestCase.status || 'draft'} onChange={(e) => setEditingTestCase({ ...editingTestCase, status: e.target.value as TestCase['status'] })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"><option value="draft">Draft</option><option value="ready">Ready</option><option value="approved">Approved</option><option value="deprecated">Deprecated</option></select></div>
              </div>
              <div><label className="text-sm text-muted-foreground mb-1 block">Folder</label><select value={editingTestCase.folderId || 'root'} onChange={(e) => setEditingTestCase({ ...editingTestCase, folderId: e.target.value === 'root' ? null : e.target.value })} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground"><option value="root">Test Repository (Root)</option>{folders.filter(f => f.id !== 'root').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
              <div><label className="text-sm text-muted-foreground mb-1 block">Tags (comma separated)</label><Input value={editingTestCase.tags?.join(', ') || ''} onChange={(e) => setEditingTestCase({ ...editingTestCase, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="e.g., smoke, regression, login" className="bg-secondary border-border" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { handleEditTest(editingTestCase!); setShowEditTestConfigDialog(false); }} className="border-border mr-auto"><Pencil className="w-4 h-4 mr-1" />Edit Steps</Button>
            <Button variant="outline" onClick={() => setShowEditTestConfigDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={onSaveTestConfig} className="bg-amber-500 hover:bg-amber-400">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Run Results Dialog */}
      <TestRunResultsDialog
        open={showResultsDialog}
        onClose={onCloseResults}
        run={selectedRunForResults}
        testCase={selectedRunForResults?.testCaseId ? testCases.find(tc => tc.id === selectedRunForResults.testCaseId) || null : null}
        testCases={testCases}
        onRerun={onRerunFromResults}
      />

      {/* Create Defect Dialog */}
      <Dialog open={showCreateDefectDialog} onOpenChange={setShowCreateDefectDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bug className="w-5 h-5 text-red-400" />Report New Defect</DialogTitle></DialogHeader>
          <CreateDefectForm testCases={testCases} testRuns={testRuns} onSubmit={onCreateDefect} onCancel={() => setShowCreateDefectDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Defect Dialog */}
      <Dialog open={showEditDefectDialog} onOpenChange={setShowEditDefectDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bug className="w-5 h-5 text-blue-600 dark:text-primary" />Edit Defect - {editingDefect?.id}</DialogTitle></DialogHeader>
          {editingDefect && <CreateDefectForm testCases={testCases} testRuns={testRuns} initialDefect={editingDefect} onSubmit={onUpdateDefect} onCancel={() => { setShowEditDefectDialog(false); setEditingDefect(null); }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
