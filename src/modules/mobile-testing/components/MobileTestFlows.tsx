/**
 * MobileTestFlows - Test Flow Management Component
 * 
 * Features:
 * - Browse, search, filter saved Maestro flows
 * - Create / edit / delete / duplicate flows
 * - Folder organization
 * - YAML editor with flow detail view
 * - Import/export YAML files
 * - Run individual flows
 * - Priority & tag management
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMobileTestingStore, computeFilteredFlows } from '@/modules/mobile-testing/store/mobileTestingStore';
import type { MobileTestFlow, FlowPriority, MobilePlatform } from '@/modules/mobile-testing/store/mobileTestingStore';
import { mobile, isElectron } from '@/lib/electron-bridge';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  FolderPlus,
  FileCode,
  Play,
  Trash2,
  Copy,
  Edit3,
  ChevronRight,
  ChevronDown,
  Folder,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Apple,
  Bot,
  Smartphone,
  Loader2,
  Save,
  X,
  ArrowUpDown,
} from 'lucide-react';

const PRIORITY_COLORS: Record<FlowPriority, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
  low: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

const STATUS_ICONS = {
  passed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  running: <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin" />,
  skipped: <AlertCircle className="w-3.5 h-3.5 text-gray-400" />,
  error: <XCircle className="w-3.5 h-3.5 text-amber-500" />,
};

export default function MobileTestFlows() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const inElectron = isElectron();

  // Individual selectors to avoid re-render storms
  const flows = useMobileTestingStore(s => s.flows);
  const folders = useMobileTestingStore(s => s.folders);
  const activeFlowId = useMobileTestingStore(s => s.activeFlowId);
  const flowSearchQuery = useMobileTestingStore(s => s.flowSearchQuery);
  const flowFilterPlatform = useMobileTestingStore(s => s.flowFilterPlatform);
  const flowFilterPriority = useMobileTestingStore(s => s.flowFilterPriority);
  const selectedPlatform = useMobileTestingStore(s => s.selectedPlatform);
  const selectedDevice = useMobileTestingStore(s => s.selectedDevice);
  const maestroInstalled = useMobileTestingStore(s => s.maestroInstalled);
  const isRunningTest = useMobileTestingStore(s => s.isRunningTest);
  const createFlow = useMobileTestingStore(s => s.createFlow);
  const updateFlow = useMobileTestingStore(s => s.updateFlow);
  const deleteFlow = useMobileTestingStore(s => s.deleteFlow);
  const duplicateFlow = useMobileTestingStore(s => s.duplicateFlow);
  const setActiveFlow = useMobileTestingStore(s => s.setActiveFlow);
  const setFlowSearch = useMobileTestingStore(s => s.setFlowSearch);
  const setFlowFilterPlatform = useMobileTestingStore(s => s.setFlowFilterPlatform);
  const setFlowFilterPriority = useMobileTestingStore(s => s.setFlowFilterPriority);
  const createFolder = useMobileTestingStore(s => s.createFolder);
  const deleteFolder = useMobileTestingStore(s => s.deleteFolder);
  const toggleFolder = useMobileTestingStore(s => s.toggleFolder);
  const setIsRunningTest = useMobileTestingStore(s => s.setIsRunningTest);
  const addTestRun = useMobileTestingStore(s => s.addTestRun);
  const addStudioOutput = useMobileTestingStore(s => s.addStudioOutput);
  const clearStudioOutput = useMobileTestingStore(s => s.clearStudioOutput);

  // Compute filtered flows with useMemo — stable reference
  const filteredFlows = useMemo(
    () => computeFilteredFlows(flows, flowSearchQuery, flowFilterPlatform, flowFilterPriority, 'all'),
    [flows, flowSearchQuery, flowFilterPlatform, flowFilterPriority]
  );
  const activeFlow = useMemo(
    () => activeFlowId ? flows.find(f => f.id === activeFlowId) ?? null : null,
    [flows, activeFlowId]
  );

  const [isCreating, setIsCreating] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [editingYaml, setEditingYaml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [editingTags, setEditingTags] = useState('');
  const [editingPriority, setEditingPriority] = useState<FlowPriority>('medium');
  const [editingPlatform, setEditingPlatform] = useState<MobilePlatform>('ios');
  const [editingBundleId, setEditingBundleId] = useState('');

  const handleCreateFlow = () => {
    if (!newFlowName.trim()) {
      toast.error('Please enter a flow name');
      return;
    }
    const id = createFlow({
      name: newFlowName.trim(),
      description: '',
      folder_id: null,
      yaml: `appId: com.example.app\n---\n- launchApp\n# Add your test steps here`,
      app_bundle_id: '',
      platform: selectedPlatform,
      tags: [],
      priority: 'medium',
    });
    setActiveFlow(id);
    setNewFlowName('');
    setIsCreating(false);
    toast.success('Flow created!');
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim());
    setNewFolderName('');
    setIsCreatingFolder(false);
    toast.success('Folder created!');
  };

  const handleSelectFlow = (flow: MobileTestFlow) => {
    setActiveFlow(flow.id);
    setEditingYaml(flow.yaml);
    setEditingName(flow.name);
    setEditingDesc(flow.description);
    setEditingTags(flow.tags.join(', '));
    setEditingPriority(flow.priority);
    setEditingPlatform(flow.platform);
    setEditingBundleId(flow.app_bundle_id);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!activeFlowId) return;
    updateFlow(activeFlowId, {
      name: editingName,
      description: editingDesc,
      yaml: editingYaml,
      tags: editingTags.split(',').map(t => t.trim()).filter(Boolean),
      priority: editingPriority,
      platform: editingPlatform,
      app_bundle_id: editingBundleId,
    });
    setIsEditing(false);
    toast.success('Flow updated!');
  };

  const handleRunFlow = async (flow: MobileTestFlow) => {
    if (!inElectron || !maestroInstalled) {
      toast.error('Maestro must be installed in the desktop app');
      return;
    }
    if (!flow.app_bundle_id) {
      toast.error('Set a Bundle ID for this flow first');
      return;
    }

    setIsRunningTest(true);
    clearStudioOutput();
    addStudioOutput(`Running flow: ${flow.name}...`);

    const startTime = Date.now();
    try {
      const steps = flow.yaml.split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => ({ action: line.trim().substring(2) }));

      const result = await mobile.runNativeTest(steps, flow.app_bundle_id, flow.platform, selectedDevice);
      const duration = Date.now() - startTime;

      const passed = result.success;
      updateFlow(flow.id, {
        last_run_at: new Date().toISOString(),
        last_run_status: passed ? 'passed' : 'failed',
        run_count: flow.run_count + 1,
      });

      addTestRun({
        flow_id: flow.id,
        flow_name: flow.name,
        platform: flow.platform,
        device: selectedDevice || 'default',
        app_bundle_id: flow.app_bundle_id,
        status: passed ? 'passed' : 'failed',
        duration_ms: duration,
        steps_total: steps.length,
        steps_passed: passed ? steps.length : 0,
        steps_failed: passed ? 0 : steps.length,
        output: passed ? ['Test completed successfully'] : [`Test failed: ${result.error}`],
        screenshots: [],
        error_message: passed ? null : (result.error || 'Unknown error'),
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
      });

      toast[passed ? 'success' : 'error'](passed ? 'Test passed!' : `Test failed: ${result.error}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const yaml = ev.target?.result as string;
        const name = file.name.replace(/\.(yaml|yml)$/, '');
        const id = createFlow({
          name,
          description: `Imported from ${file.name}`,
          folder_id: null,
          yaml,
          app_bundle_id: '',
          platform: selectedPlatform,
          tags: ['imported'],
          priority: 'medium',
        });
        setActiveFlow(id);
        toast.success(`Imported "${name}"!`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = (flow: MobileTestFlow) => {
    const blob = new Blob([flow.yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flow.name.replace(/\s+/g, '-').toLowerCase()}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Flow exported!');
  };

  // Group flows by folder
  const rootFlows = filteredFlows.filter(f => !f.folder_id);
  const folderFlows = (folderId: string) => filteredFlows.filter(f => f.folder_id === folderId);

  return (
    <div className="flex gap-6 h-[calc(100vh-220px)]">
      {/* Left: Flow List */}
      <div className={cn(
        "w-80 shrink-0 rounded-xl border flex flex-col",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-inherit">
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn("text-sm font-semibold", isDark ? 'text-white' : 'text-gray-900')}>Test Flows</h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsCreatingFolder(true)}>
                <FolderPlus className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleImport}>
                <Upload className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-violet-500 hover:bg-violet-600 text-white"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={flowSearchQuery}
              onChange={(e) => setFlowSearch(e.target.value)}
              placeholder="Search flows..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-1">
                {(['all', 'ios', 'android'] as const).map(p => (
                  <Button
                    key={p}
                    variant={flowFilterPlatform === p ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] flex-1"
                    onClick={() => setFlowFilterPlatform(p)}
                  >
                    {p === 'all' ? 'All' : p === 'ios' ? 'iOS' : 'Android'}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
                  <Button
                    key={p}
                    variant={flowFilterPriority === p ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] flex-1"
                    onClick={() => setFlowFilterPriority(p)}
                  >
                    {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Create New Flow */}
          {isCreating && (
            <div className="mt-3 flex gap-2">
              <Input
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                placeholder="Flow name..."
                className="h-8 text-xs flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFlow()}
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleCreateFlow}><Plus className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsCreating(false)}><X className="w-3 h-3" /></Button>
            </div>
          )}

          {/* Create Folder */}
          {isCreatingFolder && (
            <div className="mt-3 flex gap-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                className="h-8 text-xs flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleCreateFolder}><FolderPlus className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsCreatingFolder(false)}><X className="w-3 h-3" /></Button>
            </div>
          )}
        </div>

        {/* Flow List */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Folders */}
          {folders.map(folder => (
            <div key={folder.id} className="mb-1">
              <button
                onClick={() => toggleFolder(folder.id)}
                className={cn(
                  "w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-colors",
                  isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {folder.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Folder className="w-3.5 h-3.5" style={{ color: folder.color }} />
                {folder.name}
                <Badge variant="outline" className="ml-auto text-[9px] h-4">
                  {folderFlows(folder.id).length}
                </Badge>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
              {folder.expanded && folderFlows(folder.id).map(flow => (
                <FlowItem
                  key={flow.id}
                  flow={flow}
                  isActive={activeFlowId === flow.id}
                  isDark={isDark}
                  onClick={() => handleSelectFlow(flow)}
                  onRun={() => handleRunFlow(flow)}
                  onDuplicate={() => duplicateFlow(flow.id)}
                  onDelete={() => deleteFlow(flow.id)}
                  onExport={() => handleExport(flow)}
                  indent
                />
              ))}
            </div>
          ))}

          {/* Root Flows */}
          {rootFlows.map(flow => (
            <FlowItem
              key={flow.id}
              flow={flow}
              isActive={activeFlowId === flow.id}
              isDark={isDark}
              onClick={() => handleSelectFlow(flow)}
              onRun={() => handleRunFlow(flow)}
              onDuplicate={() => duplicateFlow(flow.id)}
              onDelete={() => deleteFlow(flow.id)}
              onExport={() => handleExport(flow)}
            />
          ))}

          {filteredFlows.length === 0 && (
            <div className={cn("text-center py-8 text-sm", isDark ? 'text-gray-500' : 'text-gray-400')}>
              {flowSearchQuery ? 'No flows match your search' : 'No test flows yet. Create one!'}
            </div>
          )}
        </div>
      </div>

      {/* Right: Flow Detail / Editor */}
      <div className="flex-1 min-w-0">
        {activeFlow ? (
          <div className={cn(
            "rounded-xl border h-full flex flex-col",
            isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
          )}>
            {/* Detail Header */}
            <div className="p-4 border-b border-inherit">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {isEditing ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8 text-sm font-semibold"
                    />
                  ) : (
                    <h2 className={cn("text-lg font-semibold truncate", isDark ? 'text-white' : 'text-gray-900')}>
                      {activeFlow.name}
                    </h2>
                  )}
                  <Badge className={cn("text-[10px] shrink-0 border", PRIORITY_COLORS[activeFlow.priority])}>
                    {activeFlow.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {activeFlow.platform === 'ios' ? 'iOS' : 'Android'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={handleSaveEdit} className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Save className="w-3 h-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="h-7 text-xs">
                        <Edit3 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-violet-500 hover:bg-violet-600 text-white"
                        onClick={() => handleRunFlow(activeFlow)}
                        disabled={isRunningTest || !maestroInstalled}
                      >
                        {isRunningTest ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                        Run
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Metadata Row */}
              {isEditing ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Description</label>
                    <Input value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} className="h-7 text-xs" placeholder="Description..." />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Bundle ID</label>
                    <Input value={editingBundleId} onChange={(e) => setEditingBundleId(e.target.value)} className="h-7 text-xs" placeholder="com.example.app" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Tags (comma-separated)</label>
                    <Input value={editingTags} onChange={(e) => setEditingTags(e.target.value)} className="h-7 text-xs" placeholder="auth, smoke, regression" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">Priority</label>
                      <select
                        value={editingPriority}
                        onChange={(e) => setEditingPriority(e.target.value as FlowPriority)}
                        className={cn("w-full h-7 rounded-md border text-xs px-2", isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">Platform</label>
                      <select
                        value={editingPlatform}
                        onChange={(e) => setEditingPlatform(e.target.value as MobilePlatform)}
                        className={cn("w-full h-7 rounded-md border text-xs px-2", isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
                      >
                        <option value="ios">iOS</option>
                        <option value="android">Android</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  {activeFlow.description && (
                    <span className={cn("text-xs", isDark ? 'text-gray-400' : 'text-gray-500')}>{activeFlow.description}</span>
                  )}
                  {activeFlow.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] h-4">
                      <Tag className="w-2.5 h-2.5 mr-0.5" />{tag}
                    </Badge>
                  ))}
                  {activeFlow.last_run_at && (
                    <span className={cn("text-[10px] flex items-center gap-1", isDark ? 'text-gray-500' : 'text-gray-400')}>
                      <Clock className="w-3 h-3" />
                      Last run: {new Date(activeFlow.last_run_at).toLocaleString()}
                      {activeFlow.last_run_status && STATUS_ICONS[activeFlow.last_run_status]}
                    </span>
                  )}
                  <span className={cn("text-[10px]", isDark ? 'text-gray-500' : 'text-gray-400')}>
                    {activeFlow.run_count} runs
                  </span>
                </div>
              )}
            </div>

            {/* YAML Editor */}
            <div className="flex-1 p-4 overflow-hidden">
              <Textarea
                value={isEditing ? editingYaml : activeFlow.yaml}
                onChange={(e) => setEditingYaml(e.target.value)}
                readOnly={!isEditing}
                className={cn(
                  "h-full font-mono text-xs resize-none",
                  isDark ? "bg-gray-950 border-gray-700" : "bg-gray-50 border-gray-200",
                  !isEditing && "cursor-default"
                )}
              />
            </div>
          </div>
        ) : (
          <div className={cn(
            "rounded-xl border h-full flex items-center justify-center",
            isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
          )}>
            <div className="text-center">
              <FileCode className={cn("w-12 h-12 mx-auto mb-3", isDark ? 'text-gray-600' : 'text-gray-300')} />
              <p className={cn("text-sm font-medium mb-1", isDark ? 'text-gray-400' : 'text-gray-500')}>
                Select a flow to view details
              </p>
              <p className={cn("text-xs mb-4", isDark ? 'text-gray-500' : 'text-gray-400')}>
                Or create a new test flow to get started
              </p>
              <Button onClick={() => setIsCreating(true)} size="sm" className="bg-violet-500 hover:bg-violet-600 text-white">
                <Plus className="w-4 h-4 mr-1" /> New Flow
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FlowItem Sub-Component
// ============================================================================

interface FlowItemProps {
  flow: MobileTestFlow;
  isActive: boolean;
  isDark: boolean;
  onClick: () => void;
  onRun: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
  indent?: boolean;
}

function FlowItem({ flow, isActive, isDark, onClick, onRun, onDuplicate, onDelete, onExport, indent }: FlowItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        "group relative p-2 rounded-lg cursor-pointer transition-all text-xs mb-1",
        indent && "ml-4",
        isActive
          ? isDark
            ? "bg-violet-500/20 border border-violet-500/50"
            : "bg-violet-50 border border-violet-200"
          : isDark
            ? "hover:bg-gray-800"
            : "hover:bg-gray-50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className="shrink-0">
          {flow.last_run_status ? STATUS_ICONS[flow.last_run_status] : (
            <FileCode className={cn("w-3.5 h-3.5", isDark ? 'text-gray-500' : 'text-gray-400')} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("font-medium truncate", isDark ? 'text-gray-200' : 'text-gray-800')}>
            {flow.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[9px] h-3.5 px-1">
              {flow.platform === 'ios' ? 'iOS' : 'Android'}
            </Badge>
            <Badge className={cn("text-[9px] h-3.5 px-1 border", PRIORITY_COLORS[flow.priority])}>
              {flow.priority}
            </Badge>
            {flow.run_count > 0 && (
              <span className={cn("text-[9px]", isDark ? 'text-gray-500' : 'text-gray-400')}>
                {flow.run_count} runs
              </span>
            )}
          </div>
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className={cn("p-1 rounded hover:bg-emerald-500/20", isDark ? 'text-emerald-400' : 'text-emerald-600')}
            title="Run"
          >
            <Play className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className={cn("p-1 rounded hover:bg-sky-500/20", isDark ? 'text-sky-400' : 'text-sky-600')}
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            className={cn("p-1 rounded hover:bg-amber-500/20", isDark ? 'text-amber-400' : 'text-amber-600')}
            title="Export"
          >
            <Download className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={cn("p-1 rounded hover:bg-red-500/20", isDark ? 'text-red-400' : 'text-red-600')}
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
