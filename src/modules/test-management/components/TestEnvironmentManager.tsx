/**
 * TestEnvironmentManager — CRUD UI for project-level test environments.
 *
 * Testers define environment profiles (name + base URL + variables) so
 * the same test case can run against QA, Staging, or Preprod by selecting
 * an environment at execution time.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Trash2, Eye, EyeOff, Edit, Save, X,
  Globe, Star, StarOff, ChevronDown, ChevronRight, Variable,
} from 'lucide-react';
import type { TestEnvironment } from '../types/workflow-editor.types';

// ============================================================================
// Props
// ============================================================================

interface TestEnvironmentManagerProps {
  environments: TestEnvironment[];
  onEnvironmentsChange: (envs: TestEnvironment[]) => void;
  projectId: string;
}

// ============================================================================
// Component
// ============================================================================

export default function TestEnvironmentManager({
  environments,
  onEnvironmentsChange,
  projectId,
}: TestEnvironmentManagerProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());

  // New environment form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');

  // ─── Helpers ─────────────────────────────────────────────────────────

  const apiBase = (() => {
    try {
      const { API_BASE_URL } = require('@/lib/api-config');
      return API_BASE_URL;
    } catch {
      return 'http://localhost:8000';
    }
  })();

  const saveToServer = useCallback(async (env: TestEnvironment, method: 'POST' | 'PUT') => {
    try {
      const url = method === 'POST'
        ? `${apiBase}/api/test-environments`
        : `${apiBase}/api/test-environments/${env.id}`;
      const body = method === 'POST'
        ? { project_id: projectId, name: env.name, base_url: env.base_url, variables: env.variables, is_default: env.is_default }
        : { name: env.name, base_url: env.base_url, variables: env.variables, is_default: env.is_default };
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.warn('[TestEnvManager] Server save failed, using local state:', e);
    }
  }, [apiBase, projectId]);

  const deleteFromServer = useCallback(async (envId: string) => {
    try {
      await fetch(`${apiBase}/api/test-environments/${envId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('[TestEnvManager] Server delete failed:', e);
    }
  }, [apiBase]);

  // ─── Actions ─────────────────────────────────────────────────────────

  const handleAdd = () => {
    if (!newName.trim() || !newBaseUrl.trim()) {
      toast({ title: 'Name and Base URL required', variant: 'destructive' });
      return;
    }
    if (environments.some(e => e.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast({ title: 'Environment name already exists', variant: 'destructive' });
      return;
    }

    const newEnv: TestEnvironment = {
      id: crypto.randomUUID(),
      project_id: projectId,
      name: newName.trim(),
      base_url: newBaseUrl.trim().replace(/\/+$/, ''),
      variables: [],
      is_default: environments.length === 0,
    };

    const updated = [...environments, newEnv];
    onEnvironmentsChange(updated);
    saveToServer(newEnv, 'POST');

    setNewName('');
    setNewBaseUrl('');
    setIsAdding(false);
    toast({ title: `Environment "${newEnv.name}" created` });
  };

  const handleDelete = (envId: string) => {
    const env = environments.find(e => e.id === envId);
    const updated = environments.filter(e => e.id !== envId);

    // If deleted env was default, make first remaining env default
    if (env?.is_default && updated.length > 0) {
      updated[0] = { ...updated[0], is_default: true };
    }

    onEnvironmentsChange(updated);
    deleteFromServer(envId);
    toast({ title: `Environment deleted` });
  };

  const handleSetDefault = (envId: string) => {
    const updated = environments.map(e => ({
      ...e,
      is_default: e.id === envId,
    }));
    onEnvironmentsChange(updated);

    const env = updated.find(e => e.id === envId);
    if (env) saveToServer(env, 'PUT');
    toast({ title: `"${env?.name}" set as default` });
  };

  const startEdit = (env: TestEnvironment) => {
    setEditingId(env.id);
    setEditName(env.name);
    setEditBaseUrl(env.base_url);
  };

  const handleSaveEdit = (envId: string) => {
    if (!editName.trim() || !editBaseUrl.trim()) {
      toast({ title: 'Name and Base URL required', variant: 'destructive' });
      return;
    }

    const updated = environments.map(e =>
      e.id === envId
        ? { ...e, name: editName.trim(), base_url: editBaseUrl.trim().replace(/\/+$/, '') }
        : e
    );
    onEnvironmentsChange(updated);

    const env = updated.find(e => e.id === envId);
    if (env) saveToServer(env, 'PUT');

    setEditingId(null);
    toast({ title: 'Environment updated' });
  };

  // ─── Variable Management ────────────────────────────────────────────

  const addVariable = (envId: string) => {
    const updated = environments.map(e =>
      e.id === envId
        ? { ...e, variables: [...e.variables, { key: '', value: '', type: 'default' as const, enabled: true }] }
        : e
    );
    onEnvironmentsChange(updated);
  };

  const updateVariable = (envId: string, idx: number, field: string, value: any) => {
    const updated = environments.map(e => {
      if (e.id !== envId) return e;
      const vars = [...e.variables];
      vars[idx] = { ...vars[idx], [field]: value };
      return { ...e, variables: vars };
    });
    onEnvironmentsChange(updated);
  };

  const removeVariable = (envId: string, idx: number) => {
    const updated = environments.map(e => {
      if (e.id !== envId) return e;
      return { ...e, variables: e.variables.filter((_, i) => i !== idx) };
    });
    onEnvironmentsChange(updated);
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Test Environments</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define base URLs for QA, Staging, Preprod — select at run time
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="border border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Staging"
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Base URL</Label>
              <Input
                value={newBaseUrl}
                onChange={e => setNewBaseUrl(e.target.value)}
                placeholder="https://staging.example.com"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(''); setNewBaseUrl(''); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd}>
              <Save className="h-3.5 w-3.5 mr-1" /> Create
            </Button>
          </div>
        </div>
      )}

      {/* Environment List */}
      <ScrollArea className="max-h-[340px]">
        <div className="space-y-2">
          {environments.length === 0 && !isAdding && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No environments defined yet.<br />
              Add one to switch between QA, Staging, and Preprod.
            </div>
          )}

          {environments.map(env => (
            <div
              key={env.id}
              className="border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            >
              {/* Environment Row */}
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Expand arrow */}
                <button
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  onClick={() => setExpandedId(expandedId === env.id ? null : env.id)}
                >
                  {expandedId === env.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {/* Default star */}
                <button
                  className={`p-0.5 ${env.is_default ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-400'}`}
                  onClick={() => handleSetDefault(env.id)}
                  title={env.is_default ? 'Default environment' : 'Set as default'}
                >
                  {env.is_default ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                </button>

                {/* Name & URL */}
                {editingId === env.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <Input
                      value={editBaseUrl}
                      onChange={e => setEditBaseUrl(e.target.value)}
                      className="h-7 text-sm flex-[2]"
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{env.name}</span>
                      {env.is_default && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Default</Badge>}
                      {env.variables.length > 0 && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          <Variable className="h-2.5 w-2.5 mr-0.5" />{env.variables.length} vars
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{env.base_url}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {editingId === env.id ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(env.id)}>
                        <Save className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(env)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => handleDelete(env.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded: Variables */}
              {expandedId === env.id && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 bg-gray-50/50 dark:bg-gray-950/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Variables (use in steps as {'{{key}}'})</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => addVariable(env.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Variable
                    </Button>
                  </div>

                  {env.variables.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2 text-center">No variables. Add one above.</p>
                  )}

                  <div className="space-y-1.5">
                    {env.variables.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Input
                          value={v.key}
                          onChange={e => updateVariable(env.id, idx, 'key', e.target.value)}
                          placeholder="KEY"
                          className="h-7 text-xs flex-1 font-mono"
                        />
                        <span className="text-muted-foreground text-xs">=</span>
                        <div className="flex-[2] relative">
                          <Input
                            value={v.value}
                            onChange={e => updateVariable(env.id, idx, 'value', e.target.value)}
                            type={v.type === 'secret' && !showSecrets.has(`${env.id}-${idx}`) ? 'password' : 'text'}
                            placeholder="value"
                            className="h-7 text-xs pr-7"
                          />
                          {v.type === 'secret' && (
                            <button
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleSecretVisibility(`${env.id}-${idx}`)}
                            >
                              {showSecrets.has(`${env.id}-${idx}`) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <button
                          className={`h-7 px-1.5 text-[10px] rounded border ${v.type === 'secret' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'border-gray-200 dark:border-gray-700 text-muted-foreground'}`}
                          onClick={() => updateVariable(env.id, idx, 'type', v.type === 'secret' ? 'default' : 'secret')}
                          title={v.type === 'secret' ? 'Secret (masked)' : 'Click to mark as secret'}
                        >
                          {v.type === 'secret' ? '🔒' : '📄'}
                        </button>
                        <button
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-red-500"
                          onClick={() => removeVariable(env.id, idx)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Save variables to server */}
                  {env.variables.length > 0 && (
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => {
                          saveToServer(env, 'PUT');
                          toast({ title: 'Variables saved' });
                        }}
                      >
                        <Save className="h-3 w-3 mr-1" /> Save Variables
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
