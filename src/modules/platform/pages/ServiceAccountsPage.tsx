/**
 * ServiceAccountsPage — Manage CI/CD API Tokens
 *
 * Admins can create, revoke, and regenerate API tokens for service accounts
 * used by CI/CD pipelines, automation scripts, and integrations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Bot, Plus, Copy, Trash2, RefreshCw, Key, Shield, Clock,
  CheckCircle2, AlertTriangle, Activity, Eye, EyeOff, Terminal,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ServiceAccount {
  id: string;
  name: string;
  description: string;
  token_prefix: string;
  permissions: string[];
  project_ids: string[];
  last_used_at: string | null;
  usage_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface CreateResult {
  success: boolean;
  id: string;
  name: string;
  token: string;
  token_prefix: string;
  permissions: string[];
  project_ids: string[];
  expires_at: string | null;
  message: string;
}

const AVAILABLE_PERMISSIONS = [
  { value: 'test_cases:read', label: 'Test Cases — Read' },
  { value: 'test_cases:create', label: 'Test Cases — Create' },
  { value: 'test_cases:update', label: 'Test Cases — Update' },
  { value: 'test_runs:create', label: 'Test Runs — Create' },
  { value: 'test_runs:read', label: 'Test Runs — Read' },
  { value: 'api_collections:read', label: 'API Collections — Read' },
  { value: 'api_collections:create', label: 'API Collections — Create' },
  { value: 'perf_scenarios:read', label: 'Performance — Read' },
  { value: 'perf_scenarios:create', label: 'Performance — Create' },
  { value: 'defects:read', label: 'Defects — Read' },
  { value: 'defects:create', label: 'Defects — Create' },
  { value: 'requirements:read', label: 'Requirements — Read' },
  { value: 'visual_baselines:read', label: 'Visual Testing — Read' },
  { value: 'a11y_configs:read', label: 'Accessibility — Read' },
  { value: 'mobile_flows:read', label: 'Mobile Flows — Read' },
  { value: 'mobile_flows:create', label: 'Mobile Flows — Create' },
];

const EXPIRY_OPTIONS = [
  { value: '0', label: 'Never expires' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
  { value: '365', label: '1 year' },
];

export default function ServiceAccountsPage() {
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [expiresDays, setExpiresDays] = useState('0');
  const [creating, setCreating] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/service-accounts/list');
      setAccounts(res.data.accounts || []);
    } catch (err) {
      console.error('Failed to load service accounts:', err);
      // Demo fallback
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await apiClient.post('/api/service-accounts/create', {
        name: name.trim(),
        description,
        permissions: selectedPermissions,
        expires_days: expiresDays === '0' ? null : parseInt(expiresDays),
      });
      const result: CreateResult = res.data;
      if (result.success) {
        setNewToken(result.token);
        setCreateOpen(false);
        setName('');
        setDescription('');
        setSelectedPermissions([]);
        setExpiresDays('0');
        fetchAccounts();
      }
    } catch (err) {
      console.error('Failed to create service account:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (accountId: string) => {
    if (!confirm('Are you sure you want to revoke this service account? Its API token will stop working immediately.')) {
      return;
    }
    try {
      await apiClient.post('/api/service-accounts/revoke', { account_id: accountId });
      fetchAccounts();
    } catch (err) {
      console.error('Revoke failed:', err);
    }
  };

  const handleRegenerate = async (accountId: string) => {
    if (!confirm('Regenerate token? The old token will be invalidated immediately.')) {
      return;
    }
    try {
      const res = await apiClient.post('/api/service-accounts/regenerate', { account_id: accountId });
      if (res.data.token) {
        setNewToken(res.data.token);
        setShowToken(false);
        setCopied(false);
        fetchAccounts();
      }
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
  };

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-7 h-7 text-primary" />
            Service Accounts
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage API tokens for CI/CD pipelines, automation scripts, and integrations
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Service Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Service Account</DialogTitle>
              <DialogDescription>
                Create an API token for programmatic access. The token will only be shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., CI Pipeline, GitHub Actions"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What this token is used for"
                />
              </div>
              <div>
                <Label>Token Expiry</Label>
                <Select value={expiresDays} onValueChange={setExpiresDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label key={perm.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm.value)}
                        onChange={() => togglePermission(perm.value)}
                        className="rounded"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedPermissions.length} permission{selectedPermissions.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                {creating ? 'Creating...' : 'Create & Generate Token'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Token Alert */}
      {newToken && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  Save your API token now — it won't be shown again!
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-gray-900 p-3 rounded border font-mono text-sm break-all">
                    {showToken ? newToken : newToken.substring(0, 12) + '•'.repeat(32)}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={copyToken}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setNewToken(null)}>
                    I've saved the token
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Using API Tokens</p>
              <p className="text-sm text-muted-foreground mt-1">
                Include the token in the <code className="bg-muted px-1 rounded">X-API-Key</code> header:
              </p>
              <pre className="mt-2 bg-muted p-3 rounded text-xs overflow-x-auto">
{`curl -H "X-API-Key: qaai_your_token_here" \\
     https://your-domain/api/test-cases`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading service accounts...</div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No service accounts yet</p>
            <p className="text-muted-foreground mt-1">
              Create your first service account to enable API access for CI/CD pipelines.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <Card key={account.id} className={!account.is_active ? 'opacity-50' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{account.name}</h3>
                      {account.is_active ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Revoked</Badge>
                      )}
                      {account.expires_at && new Date(account.expires_at) < new Date() && (
                        <Badge variant="outline" className="text-amber-600 border-amber-400">
                          Expired
                        </Badge>
                      )}
                    </div>
                    {account.description && (
                      <p className="text-sm text-muted-foreground mt-1">{account.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        {account.token_prefix}•••
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {account.usage_count} calls
                      </span>
                      {account.last_used_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last used: {formatDate(account.last_used_at)}
                        </span>
                      )}
                      {account.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires: {formatDate(account.expires_at)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {account.permissions.length} permissions
                      </span>
                    </div>

                    {account.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {account.permissions.slice(0, 6).map(perm => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                        {account.permissions.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{account.permissions.length - 6} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {account.is_active && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRegenerate(account.id)}
                        title="Regenerate token"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevoke(account.id)}
                        title="Revoke"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
