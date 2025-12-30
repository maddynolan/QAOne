/**
 * Reusable Modules Manager
 * 
 * Allows creating, saving, and importing reusable test modules.
 * Think of it like "Page Object Model" but visual and no-code.
 * 
 * Features:
 * - Save groups of steps as reusable modules
 * - Import modules into workflows
 * - Categorize modules (Login, Navigation, Data Entry, etc.)
 * - Share modules across workflows
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  FolderPlus,
  Download,
  Upload,
  Trash2,
  Edit,
  Copy,
  Play,
  Package,
  Layers,
  Search,
  Save,
  FolderOpen,
  Plus,
  Check,
  X
} from 'lucide-react';

// Types
export interface ReusableModule {
  id: string;
  name: string;
  description: string;
  category: 'login' | 'navigation' | 'data_entry' | 'verification' | 'cleanup' | 'custom';
  appType: string;  // salesforce, generic, etc.
  steps: ModuleStep[];
  variables: ModuleVariable[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface ModuleStep {
  type: string;
  label: string;
  selector?: string;
  value?: string;
  waitTime?: number;
  assertion?: any;
  description?: string;
}

export interface ModuleVariable {
  name: string;
  type: 'input' | 'output' | 'internal';
  defaultValue?: string;
  description?: string;
}

interface ReusableModulesManagerProps {
  currentNodes: any[];  // Current workflow nodes
  appType: string;
  onImportModule: (steps: ModuleStep[]) => void;
  onSelectSteps?: (nodeIds: string[]) => void;
}

const CATEGORY_INFO = {
  login: { label: 'Login/Auth', icon: '🔐', color: 'bg-blue-100 text-blue-700' },
  navigation: { label: 'Navigation', icon: '🧭', color: 'bg-green-100 text-green-700' },
  data_entry: { label: 'Data Entry', icon: '📝', color: 'bg-yellow-100 text-yellow-700' },
  verification: { label: 'Verification', icon: '✅', color: 'bg-purple-100 text-purple-700' },
  cleanup: { label: 'Cleanup', icon: '🧹', color: 'bg-red-100 text-red-700' },
  custom: { label: 'Custom', icon: '⚙️', color: 'bg-gray-100 text-gray-700' },
};

export function ReusableModulesManager({
  currentNodes,
  appType,
  onImportModule,
  onSelectSteps
}: ReusableModulesManagerProps) {
  const { toast } = useToast();
  
  // State
  const [modules, setModules] = useState<ReusableModule[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // New module form
  const [newModule, setNewModule] = useState({
    name: '',
    description: '',
    category: 'custom' as ReusableModule['category'],
    tags: ''
  });

  // Load modules from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('reusable_modules');
    if (saved) {
      try {
        setModules(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load modules:', e);
      }
    }
  }, []);

  // Save modules to localStorage
  const saveModulesToStorage = useCallback((updatedModules: ReusableModule[]) => {
    localStorage.setItem('reusable_modules', JSON.stringify(updatedModules));
    setModules(updatedModules);
  }, []);

  // Find group boundaries in current nodes
  const findGroupsInNodes = useCallback(() => {
    const groups: { startIdx: number; endIdx: number; name: string }[] = [];
    let currentGroup: { startIdx: number; name: string } | null = null;
    
    currentNodes.forEach((node, idx) => {
      if (node.type === 'group_start') {
        currentGroup = { startIdx: idx, name: node.data.description || 'Unnamed Group' };
      } else if (node.type === 'group_end' && currentGroup) {
        groups.push({ ...currentGroup, endIdx: idx });
        currentGroup = null;
      }
    });
    
    return groups;
  }, [currentNodes]);

  // Extract steps from selected nodes
  const extractStepsFromNodes = useCallback((nodeIds: string[]): ModuleStep[] => {
    return currentNodes
      .filter(node => nodeIds.includes(node.id) && node.type !== 'group_start' && node.type !== 'group_end')
      .map(node => ({
        type: node.type,
        label: node.label,
        selector: node.data.selector,
        value: node.data.value,
        waitTime: node.data.waitTime,
        assertion: node.data.assertion,
        description: node.data.description
      }));
  }, [currentNodes]);

  // Save current selection as module
  const saveAsModule = useCallback(() => {
    if (selectedNodes.size === 0) {
      toast({
        title: 'No steps selected',
        description: 'Select steps to save as a module',
        variant: 'destructive'
      });
      return;
    }
    
    if (!newModule.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Enter a name for the module',
        variant: 'destructive'
      });
      return;
    }
    
    const steps = extractStepsFromNodes(Array.from(selectedNodes));
    
    const module: ReusableModule = {
      id: `mod_${Date.now()}`,
      name: newModule.name.trim(),
      description: newModule.description.trim(),
      category: newModule.category,
      appType,
      steps,
      variables: [], // Could extract variables from steps
      tags: newModule.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };
    
    saveModulesToStorage([...modules, module]);
    
    toast({
      title: 'Module saved',
      description: `"${module.name}" saved with ${steps.length} steps`
    });
    
    setShowSaveDialog(false);
    setSelectedNodes(new Set());
    setNewModule({ name: '', description: '', category: 'custom', tags: '' });
  }, [selectedNodes, newModule, appType, modules, extractStepsFromNodes, saveModulesToStorage, toast]);

  // Import module into workflow
  const importModule = useCallback((module: ReusableModule) => {
    onImportModule(module.steps);
    
    // Update usage count
    const updated = modules.map(m => 
      m.id === module.id 
        ? { ...m, usageCount: m.usageCount + 1, updatedAt: new Date().toISOString() }
        : m
    );
    saveModulesToStorage(updated);
    
    toast({
      title: 'Module imported',
      description: `Added ${module.steps.length} steps from "${module.name}"`
    });
    
    setShowImportDialog(false);
  }, [modules, onImportModule, saveModulesToStorage, toast]);

  // Delete module
  const deleteModule = useCallback((moduleId: string) => {
    const updated = modules.filter(m => m.id !== moduleId);
    saveModulesToStorage(updated);
    toast({ title: 'Module deleted' });
  }, [modules, saveModulesToStorage, toast]);

  // Duplicate module
  const duplicateModule = useCallback((module: ReusableModule) => {
    const duplicate: ReusableModule = {
      ...module,
      id: `mod_${Date.now()}`,
      name: `${module.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };
    saveModulesToStorage([...modules, duplicate]);
    toast({ title: 'Module duplicated' });
  }, [modules, saveModulesToStorage, toast]);

  // Filter modules
  const filteredModules = modules.filter(module => {
    const matchesSearch = module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         module.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         module.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || module.category === filterCategory;
    const matchesApp = module.appType === appType || module.appType === 'generic';
    return matchesSearch && matchesCategory && matchesApp;
  });

  // Toggle node selection
  const toggleNodeSelection = (nodeId: string) => {
    const newSelection = new Set(selectedNodes);
    if (newSelection.has(nodeId)) {
      newSelection.delete(nodeId);
    } else {
      newSelection.add(nodeId);
    }
    setSelectedNodes(newSelection);
    onSelectSteps?.(Array.from(newSelection));
  };

  // Select all nodes in a group
  const selectGroup = (startIdx: number, endIdx: number) => {
    const groupNodeIds = currentNodes.slice(startIdx + 1, endIdx).map(n => n.id);
    setSelectedNodes(new Set(groupNodeIds));
    onSelectSteps?.(groupNodeIds);
  };

  const groups = findGroupsInNodes();

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Reusable Modules</CardTitle>
          </div>
          <Badge variant="outline">{modules.length} saved</Badge>
        </div>
        <CardDescription>
          Save and reuse groups of steps across workflows
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="save" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="save">
              <Save className="h-4 w-4 mr-1" />
              Save Module
            </TabsTrigger>
            <TabsTrigger value="import">
              <Download className="h-4 w-4 mr-1" />
              Import ({filteredModules.length})
            </TabsTrigger>
          </TabsList>

          {/* Save Tab */}
          <TabsContent value="save" className="space-y-3">
            {/* Existing Groups */}
            {groups.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Existing Groups in Workflow:</Label>
                {groups.map((group, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-slate-500" />
                      <span className="text-sm">{group.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {group.endIdx - group.startIdx - 1} steps
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectGroup(group.startIdx, group.endIdx)}
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Or select steps manually ({selectedNodes.size} selected):
              </Label>
              <div className="max-h-[150px] overflow-y-auto border rounded p-2 space-y-1">
                {currentNodes
                  .filter(n => n.type !== 'group_start' && n.type !== 'group_end')
                  .map(node => (
                    <div
                      key={node.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                        selectedNodes.has(node.id) ? 'bg-purple-100 border-purple-300' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleNodeSelection(node.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNodes.has(node.id)}
                        onChange={() => {}}
                        className="rounded"
                      />
                      <span className="font-medium">{node.label}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {node.data.selector?.slice(0, 30) || node.data.url?.slice(0, 30) || ''}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Save Button */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full"
                  disabled={selectedNodes.size === 0}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Save as Module ({selectedNodes.size} steps)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Reusable Module</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Module Name *</Label>
                    <Input
                      value={newModule.name}
                      onChange={(e) => setNewModule({ ...newModule, name: e.target.value })}
                      placeholder="e.g., Login to Salesforce"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newModule.description}
                      onChange={(e) => setNewModule({ ...newModule, description: e.target.value })}
                      placeholder="What does this module do?"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select
                      value={newModule.category}
                      onValueChange={(v) => setNewModule({ ...newModule, category: v as ReusableModule['category'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {info.icon} {info.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      value={newModule.tags}
                      onChange={(e) => setNewModule({ ...newModule, tags: e.target.value })}
                      placeholder="e.g., authentication, critical"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveAsModule}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Module
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-3">
            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search modules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.icon} {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Module List */}
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {filteredModules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No modules saved yet</p>
                  <p className="text-xs">Select steps and save them as a module</p>
                </div>
              ) : (
                filteredModules.map(module => (
                  <Card key={module.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{module.name}</span>
                          <Badge className={`text-xs ${CATEGORY_INFO[module.category].color}`}>
                            {CATEGORY_INFO[module.category].icon} {CATEGORY_INFO[module.category].label}
                          </Badge>
                        </div>
                        {module.description && (
                          <p className="text-xs text-muted-foreground mt-1">{module.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{module.steps.length} steps</span>
                          <span>•</span>
                          <span>Used {module.usageCount}x</span>
                          {module.tags.length > 0 && (
                            <>
                              <span>•</span>
                              {module.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => duplicateModule(module)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteModule(module.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => importModule(module)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ReusableModulesManager;












