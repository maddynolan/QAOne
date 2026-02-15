/**
 * Test Suite Manager - Organize workflows into test suites
 * Supports grouping, ordering, and batch execution
 */

import React, { useState, useEffect } from 'react';
import {
  FolderOpen, Plus, Play, Settings, ChevronDown, ChevronRight,
  Trash2, Copy, Edit2, Clock, CheckCircle, XCircle, Loader2,
  Save, Download, Upload, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';

export interface TestSuiteWorkflow {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  lastRun?: string;
  lastStatus?: 'passed' | 'failed' | 'skipped';
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  environment: string;
  workflows: TestSuiteWorkflow[];
  runOrder: 'sequential' | 'parallel';
  stopOnFailure: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun?: {
    timestamp: string;
    duration: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

export interface Environment {
  id: string;
  name: string;
  type: 'development' | 'qa' | 'staging' | 'production';
  baseUrl: string;
  variables: Record<string, string>;
}

interface TestSuiteManagerProps {
  onSelectWorkflow?: (workflowId: string) => void;
  onRunSuite?: (suiteId: string) => void;
}

export default function TestSuiteManager({ onSelectWorkflow, onRunSuite }: TestSuiteManagerProps) {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const [newSuite, setNewSuite] = useState({
    name: '',
    description: '',
    environment: '',
    runOrder: 'sequential' as const,
    stopOnFailure: true,
  });

  const [newEnv, setNewEnv] = useState({
    name: '',
    type: 'development' as const,
    baseUrl: '',
    variables: {} as Record<string, string>,
  });

  useEffect(() => {
    loadSuites();
    loadEnvironments();
  }, []);

  const loadSuites = async () => {
    try {
      // Load from localStorage for now, can be API later
      const saved = localStorage.getItem('test_suites');
      if (saved) {
        setSuites(JSON.parse(saved));
      } else {
        // Mock data
        setSuites([
          {
            id: 'suite-1',
            name: 'Smoke Tests',
            description: 'Quick validation of core functionality',
            environment: 'qa',
            workflows: [
              { id: 'wf-1', name: 'Login Flow', order: 1, enabled: true, lastStatus: 'passed' },
              { id: 'wf-2', name: 'Dashboard Load', order: 2, enabled: true, lastStatus: 'passed' },
            ],
            runOrder: 'sequential',
            stopOnFailure: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastRun: {
              timestamp: new Date().toISOString(),
              duration: 45,
              passed: 2,
              failed: 0,
              skipped: 0,
            },
          },
          {
            id: 'suite-2',
            name: 'Regression Suite',
            description: 'Full regression test suite',
            environment: 'staging',
            workflows: [
              { id: 'wf-3', name: 'User Registration', order: 1, enabled: true, lastStatus: 'passed' },
              { id: 'wf-4', name: 'Product Search', order: 2, enabled: true, lastStatus: 'failed' },
              { id: 'wf-5', name: 'Checkout Flow', order: 3, enabled: true, lastStatus: 'passed' },
              { id: 'wf-6', name: 'Profile Update', order: 4, enabled: false, lastStatus: 'skipped' },
            ],
            runOrder: 'sequential',
            stopOnFailure: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to load test suites:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEnvironments = async () => {
    try {
      const saved = localStorage.getItem('test_environments');
      if (saved) {
        setEnvironments(JSON.parse(saved));
      } else {
        // Mock data
        setEnvironments([
          {
            id: 'env-1',
            name: 'Development',
            type: 'development',
            baseUrl: 'http://localhost:3000',
            variables: { API_KEY: 'dev-key', DEBUG: 'true' },
          },
          {
            id: 'env-2',
            name: 'QA',
            type: 'qa',
            baseUrl: 'https://qa.example.com',
            variables: { API_KEY: 'qa-key' },
          },
          {
            id: 'env-3',
            name: 'Staging',
            type: 'staging',
            baseUrl: 'https://staging.example.com',
            variables: { API_KEY: 'staging-key' },
          },
          {
            id: 'env-4',
            name: 'Production',
            type: 'production',
            baseUrl: 'https://app.example.com',
            variables: { API_KEY: 'prod-key' },
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to load environments:', error);
    }
  };

  const saveSuites = (updatedSuites: TestSuite[]) => {
    setSuites(updatedSuites);
    localStorage.setItem('test_suites', JSON.stringify(updatedSuites));
  };

  const saveEnvironments = (updatedEnvs: Environment[]) => {
    setEnvironments(updatedEnvs);
    localStorage.setItem('test_environments', JSON.stringify(updatedEnvs));
  };

  const createSuite = () => {
    if (!newSuite.name.trim()) {
      toast.error('Suite name is required');
      return;
    }

    const suite: TestSuite = {
      id: `suite-${Date.now()}`,
      name: newSuite.name,
      description: newSuite.description,
      environment: newSuite.environment,
      workflows: [],
      runOrder: newSuite.runOrder,
      stopOnFailure: newSuite.stopOnFailure,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveSuites([...suites, suite]);
    setShowCreateDialog(false);
    setNewSuite({ name: '', description: '', environment: '', runOrder: 'sequential', stopOnFailure: true });
    toast.success('Test suite created');
  };

  const createEnvironment = () => {
    if (!newEnv.name.trim() || !newEnv.baseUrl.trim()) {
      toast.error('Name and Base URL are required');
      return;
    }

    const env: Environment = {
      id: `env-${Date.now()}`,
      name: newEnv.name,
      type: newEnv.type,
      baseUrl: newEnv.baseUrl,
      variables: newEnv.variables,
    };

    saveEnvironments([...environments, env]);
    setShowEnvDialog(false);
    setNewEnv({ name: '', type: 'development', baseUrl: '', variables: {} });
    toast.success('Environment created');
  };

  const deleteSuite = (suiteId: string) => {
    saveSuites(suites.filter(s => s.id !== suiteId));
    toast.success('Test suite deleted');
  };

  const toggleSuiteExpansion = (suiteId: string) => {
    const newExpanded = new Set(expandedSuites);
    if (newExpanded.has(suiteId)) {
      newExpanded.delete(suiteId);
    } else {
      newExpanded.add(suiteId);
    }
    setExpandedSuites(newExpanded);
  };

  const toggleWorkflowEnabled = (suiteId: string, workflowId: string) => {
    saveSuites(
      suites.map(suite => {
        if (suite.id === suiteId) {
          return {
            ...suite,
            workflows: suite.workflows.map(wf =>
              wf.id === workflowId ? { ...wf, enabled: !wf.enabled } : wf
            ),
          };
        }
        return suite;
      })
    );
  };

  const runSuite = async (suiteId: string) => {
    setRunning(suiteId);
    try {
      // Simulate running the suite
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const suite = suites.find(s => s.id === suiteId);
      if (suite) {
        const updatedSuite = {
          ...suite,
          lastRun: {
            timestamp: new Date().toISOString(),
            duration: Math.floor(Math.random() * 60) + 10,
            passed: suite.workflows.filter(w => w.enabled).length - 1,
            failed: 1,
            skipped: suite.workflows.filter(w => !w.enabled).length,
          },
        };
        saveSuites(suites.map(s => s.id === suiteId ? updatedSuite : s));
      }
      
      onRunSuite?.(suiteId);
      toast.success('Test suite execution completed');
    } catch (error) {
      toast.error('Failed to run test suite');
    } finally {
      setRunning(null);
    }
  };

  const getStatusIcon = (status?: 'passed' | 'failed' | 'skipped') => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getEnvBadge = (envId: string) => {
    const env = environments.find(e => e.id === envId || e.name.toLowerCase() === envId);
    if (!env) return null;
    
    const colors: Record<string, string> = {
      development: 'bg-blue-100 text-blue-800',
      qa: 'bg-purple-100 text-purple-800',
      staging: 'bg-yellow-100 text-yellow-800',
      production: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={colors[env.type] || 'bg-gray-100 text-gray-800'}>
        {env.name}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Test Suites</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEnvDialog(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Environments
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Suite
          </Button>
        </div>
      </div>

      {/* Environment Quick View */}
      <div className="flex flex-wrap gap-2">
        {environments.map(env => (
          <Badge key={env.id} variant="outline" className="text-xs">
            {env.name}: {env.baseUrl}
          </Badge>
        ))}
      </div>

      {/* Suites List */}
      <div className="space-y-2">
        {suites.map(suite => (
          <Card key={suite.id} className="overflow-hidden">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
              onClick={() => toggleSuiteExpansion(suite.id)}
            >
              <div className="flex items-center gap-2">
                {expandedSuites.has(suite.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <FolderOpen className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{suite.name}</span>
                <Badge variant="outline">{suite.workflows.length} workflows</Badge>
                {getEnvBadge(suite.environment)}
              </div>
              <div className="flex items-center gap-2">
                {suite.lastRun && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {suite.lastRun.passed}
                    <XCircle className="h-3 w-3 text-red-500" />
                    {suite.lastRun.failed}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    runSuite(suite.id);
                  }}
                  disabled={running === suite.id}
                >
                  {running === suite.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSuite(suite.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>

            {expandedSuites.has(suite.id) && (
              <div className="border-t bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2">{suite.description}</p>
                <div className="space-y-1">
                  {suite.workflows.map((wf, idx) => (
                    <div
                      key={wf.id}
                      className={`flex items-center justify-between p-2 rounded ${
                        wf.enabled ? 'bg-white' : 'bg-gray-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                        {getStatusIcon(wf.lastStatus)}
                        <span className={`text-sm ${!wf.enabled && 'line-through'}`}>
                          {wf.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={wf.enabled}
                          onChange={() => toggleWorkflowEnabled(suite.id, wf.id)}
                          className="rounded"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectWorkflow?.(wf.id)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {suite.runOrder === 'sequential' ? 'Sequential' : 'Parallel'}
                  </Badge>
                  {suite.stopOnFailure && (
                    <Badge variant="outline" className="text-xs">
                      Stop on Failure
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Create Suite Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Test Suite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Suite Name</Label>
              <Input
                value={newSuite.name}
                onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
                placeholder="e.g., Smoke Tests"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newSuite.description}
                onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })}
                placeholder="Brief description of the test suite"
              />
            </div>
            <div>
              <Label>Environment</Label>
              <Select
                value={newSuite.environment}
                onValueChange={(v) => setNewSuite({ ...newSuite, environment: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map(env => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name} ({env.baseUrl})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Execution Order</Label>
              <Select
                value={newSuite.runOrder}
                onValueChange={(v: 'sequential' | 'parallel') => 
                  setNewSuite({ ...newSuite, runOrder: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="stopOnFailure"
                checked={newSuite.stopOnFailure}
                onChange={(e) => setNewSuite({ ...newSuite, stopOnFailure: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="stopOnFailure">Stop on first failure</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createSuite}>Create Suite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Environment Dialog */}
      <Dialog open={showEnvDialog} onOpenChange={setShowEnvDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Environments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing environments */}
            <div className="space-y-2">
              {environments.map(env => (
                <Card key={env.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{env.name}</span>
                          <Badge variant={env.type === 'production' ? 'destructive' : 'secondary'}>
                            {env.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{env.baseUrl}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          saveEnvironments(environments.filter(e => e.id !== env.id));
                          toast.success('Environment deleted');
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add new environment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add New Environment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newEnv.name}
                      onChange={(e) => setNewEnv({ ...newEnv, name: e.target.value })}
                      placeholder="e.g., QA Server"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={newEnv.type}
                      onValueChange={(v: Environment['type']) => setNewEnv({ ...newEnv, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="qa">QA</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Base URL</Label>
                  <Input
                    value={newEnv.baseUrl}
                    onChange={(e) => setNewEnv({ ...newEnv, baseUrl: e.target.value })}
                    placeholder="https://qa.example.com"
                  />
                </div>
                <Button onClick={createEnvironment} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Environment
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

