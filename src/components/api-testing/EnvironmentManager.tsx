/**
 * EnvironmentManager - Postman-style environment variable management.
 * Key-value editor with secret masking, OAuth2 config, import/export.
 * Like Postman: supports {{variable}} syntax everywhere in requests.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Eye, EyeOff, Copy, Download, Upload,
  Settings, Key, Globe, Lock, Shield, CheckCircle2,
  Edit, Save, X, AlertCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import { API_BASE_URL } from "./constants";

// --- Types ---
export interface EnvVariable {
  key: string;
  value: string;
  type: "default" | "secret";
  enabled: boolean;
  description?: string;
}

export interface EnvironmentConfig {
  environment_id: string;
  name: string;
  type: "development" | "staging" | "production";
  base_url: string;
  variables: EnvVariable[];
  auth?: {
    type: "none" | "bearer" | "basic" | "api_key" | "oauth2";
    bearer_token?: string;
    basic_username?: string;
    basic_password?: string;
    api_key_name?: string;
    api_key_value?: string;
    api_key_location?: "header" | "query";
    oauth2_client_id?: string;
    oauth2_client_secret?: string;
    oauth2_token_url?: string;
    oauth2_scopes?: string;
    oauth2_grant_type?: "client_credentials" | "password" | "authorization_code";
    oauth2_username?: string;
    oauth2_password?: string;
  };
  created_at?: string;
  updated_at?: string;
}

interface EnvironmentManagerProps {
  environments: EnvironmentConfig[];
  selectedEnvironmentId: string;
  onEnvironmentsChange: (envs: EnvironmentConfig[]) => void;
  onSelectedChange: (id: string) => void;
}

// Convert old format {key: value} to new EnvVariable[]
function normalizeVariables(vars: any): EnvVariable[] {
  if (Array.isArray(vars)) return vars;
  if (vars && typeof vars === "object") {
    return Object.entries(vars).map(([key, value]) => ({
      key,
      value: String(value),
      type: "default" as const,
      enabled: true,
    }));
  }
  return [];
}

export default function EnvironmentManager({
  environments,
  selectedEnvironmentId,
  onEnvironmentsChange,
  onSelectedChange,
}: EnvironmentManagerProps) {
  const { toast } = useToast();
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [envTab, setEnvTab] = useState<"variables" | "auth" | "settings">("variables");
  const [expandedEnv, setExpandedEnv] = useState<string | null>(selectedEnvironmentId || null);

  // New environment form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newEnv, setNewEnv] = useState<Partial<EnvironmentConfig>>({
    name: "",
    type: "development",
    base_url: "",
    variables: [],
    auth: { type: "none" },
  });

  const selectedEnv = environments.find(e => e.environment_id === selectedEnvironmentId);

  // --- CRUD ---
  const handleCreateEnvironment = async () => {
    if (!newEnv.name || !newEnv.base_url) {
      toast({ title: "Error", description: "Name and Base URL are required", variant: "destructive" });
      return;
    }
    const env: EnvironmentConfig = {
      environment_id: `env_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: newEnv.name!,
      type: (newEnv.type as any) || "development",
      base_url: newEnv.base_url!,
      variables: newEnv.variables || [],
      auth: newEnv.auth || { type: "none" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Persist to database
    try {
      await fetch(`${API_BASE_URL}/api/db/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: env.name,
          env_type: env.type || "development",
          base_url: env.base_url,
          variables: env.variables || [],
          auth: env.auth || {},
        }),
      });
    } catch (err) {
      console.warn("Failed to save environment to DB (will use localStorage):", err);
    }
    // Also try legacy backend
    try {
      await fetch(`${API_BASE_URL}/api/v2/testing/environment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment_config: {
            ...env,
            variables: envVarsToDict(env.variables),
          },
        }),
      });
    } catch {}

    const updated = [...environments, env];
    onEnvironmentsChange(updated);
    if (environments.length === 0) onSelectedChange(env.environment_id);
    setExpandedEnv(env.environment_id);
    setShowNewForm(false);
    setNewEnv({ name: "", type: "development", base_url: "", variables: [], auth: { type: "none" } });
    toast({ title: "Environment Created", description: `"${env.name}" is ready to use` });
  };

  const handleUpdateEnvironment = (envId: string, updates: Partial<EnvironmentConfig>) => {
    const updated = environments.map(e =>
      e.environment_id === envId ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
    );
    onEnvironmentsChange(updated);
    // Also update in database
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.env_type = updates.type;
    if (updates.base_url !== undefined) dbUpdates.base_url = updates.base_url;
    if (updates.variables !== undefined) dbUpdates.variables = updates.variables;
    if (updates.auth !== undefined) dbUpdates.auth = updates.auth;
    if (Object.keys(dbUpdates).length > 0) {
      fetch(`${API_BASE_URL}/api/db/environments/${envId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbUpdates),
      }).catch(err => console.warn("Failed to update environment in DB:", err));
    }
  };

  const handleDeleteEnvironment = (envId: string) => {
    if (!confirm("Delete this environment?")) return;
    const updated = environments.filter(e => e.environment_id !== envId);
    onEnvironmentsChange(updated);
    if (selectedEnvironmentId === envId && updated.length > 0) {
      onSelectedChange(updated[0].environment_id);
    }
    // Delete from database
    fetch(`${API_BASE_URL}/api/db/environments/${envId}`, { method: "DELETE" })
      .catch(err => console.warn("Failed to delete environment from DB:", err));
    toast({ title: "Deleted", description: "Environment removed" });
  };

  const handleDuplicateEnvironment = (env: EnvironmentConfig) => {
    const dup: EnvironmentConfig = {
      ...JSON.parse(JSON.stringify(env)),
      environment_id: `env_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${env.name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onEnvironmentsChange([...environments, dup]);
    toast({ title: "Duplicated", description: `"${dup.name}" created` });
  };

  // Export environment as JSON
  const handleExport = (env: EnvironmentConfig) => {
    const exported = {
      ...env,
      auth: env.auth
        ? {
            ...env.auth,
            oauth2_client_secret: env.auth.oauth2_client_secret ? "***REDACTED***" : undefined,
            basic_password: env.auth.basic_password ? "***REDACTED***" : undefined,
          }
        : undefined,
      variables: env.variables.map(v => ({
        ...v,
        value: v.type === "secret" ? "***REDACTED***" : v.value,
      })),
    };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${env.name.replace(/\s+/g, "_")}_environment.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import environment from JSON
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const env: EnvironmentConfig = {
          environment_id: `env_${Date.now()}`,
          name: data.name || "Imported Environment",
          type: data.type || "development",
          base_url: data.base_url || "",
          variables: normalizeVariables(data.variables),
          auth: data.auth || { type: "none" },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        onEnvironmentsChange([...environments, env]);
        toast({ title: "Imported", description: `"${env.name}" imported successfully` });
      } catch {
        toast({ title: "Error", description: "Invalid JSON file", variant: "destructive" });
      }
    };
    input.click();
  };

  // --- Variable management ---
  const addVariable = (envId: string) => {
    const env = environments.find(e => e.environment_id === envId);
    if (!env) return;
    const vars = normalizeVariables(env.variables);
    handleUpdateEnvironment(envId, {
      variables: [...vars, { key: "", value: "", type: "default", enabled: true }],
    });
  };

  const updateVariable = (envId: string, idx: number, field: keyof EnvVariable, value: any) => {
    const env = environments.find(e => e.environment_id === envId);
    if (!env) return;
    const vars = [...normalizeVariables(env.variables)];
    vars[idx] = { ...vars[idx], [field]: value };
    handleUpdateEnvironment(envId, { variables: vars });
  };

  const removeVariable = (envId: string, idx: number) => {
    const env = environments.find(e => e.environment_id === envId);
    if (!env) return;
    const vars = normalizeVariables(env.variables).filter((_, i) => i !== idx);
    handleUpdateEnvironment(envId, { variables: vars });
  };

  const toggleSecret = (varKey: string) => {
    setShowSecrets(prev => ({ ...prev, [varKey]: !prev[varKey] }));
  };

  // --- Presets ---
  const addCommonVariables = (envId: string) => {
    const env = environments.find(e => e.environment_id === envId);
    if (!env) return;
    const vars = normalizeVariables(env.variables);
    const presets: EnvVariable[] = [
      { key: "base_url", value: env.base_url || "", type: "default", enabled: true, description: "API base URL" },
      { key: "api_version", value: "v1", type: "default", enabled: true, description: "API version" },
      { key: "client_id", value: "", type: "default", enabled: true, description: "OAuth2 Client ID" },
      { key: "client_secret", value: "", type: "secret", enabled: true, description: "OAuth2 Client Secret" },
      { key: "access_token", value: "", type: "secret", enabled: true, description: "Bearer access token" },
      { key: "api_key", value: "", type: "secret", enabled: true, description: "API Key" },
    ];
    // Only add presets that don't already exist
    const newVars = presets.filter(p => !vars.find(v => v.key === p.key));
    handleUpdateEnvironment(envId, { variables: [...vars, ...newVars] });
    toast({ title: "Added", description: `${newVars.length} common variables added` });
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Environment selector + Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary flex-shrink-0" />
            <Select
              value={selectedEnvironmentId || "__none__"}
              onValueChange={v => v !== "__none__" && onSelectedChange(v)}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select Environment" />
              </SelectTrigger>
              <SelectContent>
                {environments.length === 0 && (
                  <SelectItem value="__none__" disabled>No environments created</SelectItem>
                )}
                {environments.map(env => (
                  <SelectItem key={env.environment_id} value={env.environment_id}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        env.type === "production" ? "bg-red-500" :
                        env.type === "staging" ? "bg-amber-500" : "bg-green-500"
                      }`} />
                      {env.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="w-4 h-4 mr-1" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewForm(!showNewForm)}>
              <Plus className="w-4 h-4 mr-1" />
              New Environment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Environment Form */}
      {showNewForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  placeholder="Production API"
                  value={newEnv.name || ""}
                  onChange={e => setNewEnv({ ...newEnv, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={newEnv.type || "development"} onValueChange={v => setNewEnv({ ...newEnv, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Base URL *</Label>
                <Input
                  placeholder="https://api.example.com"
                  value={newEnv.base_url || ""}
                  onChange={e => setNewEnv({ ...newEnv, base_url: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateEnvironment}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Create
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environment List */}
      {environments.map(env => {
        const isExpanded = expandedEnv === env.environment_id;
        const isSelected = selectedEnvironmentId === env.environment_id;
        const vars = normalizeVariables(env.variables);

        return (
          <Card
            key={env.environment_id}
            className={`transition-all ${isSelected ? "border-primary/50 bg-primary/5" : ""}`}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30"
              onClick={() => setExpandedEnv(isExpanded ? null : env.environment_id)}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                env.type === "production" ? "bg-red-500" :
                env.type === "staging" ? "bg-amber-500" : "bg-green-500"
              }`} />
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{env.name}</span>
                <span className="text-xs text-muted-foreground ml-2 font-mono">{env.base_url}</span>
              </div>
              <Badge variant="outline" className="text-xs capitalize">{env.type}</Badge>
              <Badge variant="secondary" className="text-xs">{vars.length} vars</Badge>
              {isSelected && <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>}
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {!isSelected && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onSelectedChange(env.environment_id)}>
                    Use
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDuplicateEnvironment(env)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleExport(env)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteEnvironment(env.environment_id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <CardContent className="pt-0 pb-4 px-4">
                <Tabs value={envTab} onValueChange={v => setEnvTab(v as any)}>
                  <TabsList className="mb-3 h-8">
                    <TabsTrigger value="variables" className="text-xs h-7">
                      Variables ({vars.length})
                    </TabsTrigger>
                    <TabsTrigger value="auth" className="text-xs h-7">
                      <Lock className="w-3 h-3 mr-1" />
                      Authorization
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="text-xs h-7">
                      <Settings className="w-3 h-3 mr-1" />
                      Settings
                    </TabsTrigger>
                  </TabsList>

                  {/* Variables Tab */}
                  <TabsContent value="variables" className="mt-0">
                    <div className="space-y-2">
                      {/* Variable header */}
                      {vars.length > 0 && (
                        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-2 px-1 text-xs text-muted-foreground font-medium">
                          <span className="w-5" />
                          <span>VARIABLE</span>
                          <span>VALUE</span>
                          <span className="w-6" />
                          <span className="w-14 text-center">TYPE</span>
                          <span className="w-6" />
                        </div>
                      )}

                      {/* Variable rows */}
                      <ScrollArea className={vars.length > 8 ? "h-[320px]" : ""}>
                        <div className="space-y-1">
                          {vars.map((v, idx) => (
                            <div
                              key={idx}
                              className={`grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-2 items-center p-1 rounded ${
                                !v.enabled ? "opacity-50" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={v.enabled}
                                onChange={() => updateVariable(env.environment_id, idx, "enabled", !v.enabled)}
                                className="cursor-pointer w-4 h-4"
                              />
                              <Input
                                className="h-7 text-xs font-mono"
                                placeholder="variable_name"
                                value={v.key}
                                onChange={e => updateVariable(env.environment_id, idx, "key", e.target.value)}
                              />
                              <div className="relative">
                                <Input
                                  className="h-7 text-xs font-mono pr-7"
                                  placeholder="value"
                                  type={v.type === "secret" && !showSecrets[`${env.environment_id}_${idx}`] ? "password" : "text"}
                                  value={v.value}
                                  onChange={e => updateVariable(env.environment_id, idx, "value", e.target.value)}
                                />
                                {v.type === "secret" && (
                                  <button
                                    className="absolute right-1 top-1 p-0.5 rounded hover:bg-muted"
                                    onClick={() => toggleSecret(`${env.environment_id}_${idx}`)}
                                  >
                                    {showSecrets[`${env.environment_id}_${idx}`]
                                      ? <EyeOff className="w-3 h-3 text-muted-foreground" />
                                      : <Eye className="w-3 h-3 text-muted-foreground" />}
                                  </button>
                                )}
                              </div>
                              <span className="w-6" />
                              <Select
                                value={v.type}
                                onValueChange={val => updateVariable(env.environment_id, idx, "type", val)}
                              >
                                <SelectTrigger className="h-7 w-14 text-xs p-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="default">
                                    <span className="flex items-center gap-1 text-xs">Default</span>
                                  </SelectItem>
                                  <SelectItem value="secret">
                                    <span className="flex items-center gap-1 text-xs">
                                      <Lock className="w-3 h-3" /> Secret
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-6 p-0 text-muted-foreground hover:text-red-500"
                                onClick={() => removeVariable(env.environment_id, idx)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => addVariable(env.environment_id)}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add Variable
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => addCommonVariables(env.environment_id)}>
                          <Key className="w-3 h-3 mr-1" />
                          Add Common (client_id, api_key, etc.)
                        </Button>
                      </div>

                      {/* Usage hint */}
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                        <p className="text-xs text-muted-foreground">
                          <strong>Usage:</strong> Reference variables in requests using{" "}
                          <code className="bg-background px-1 py-0.5 rounded text-primary">{"{{variable_name}}"}</code>{" "}
                          syntax in URL, headers, body, or auth fields.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Example: <code className="bg-background px-1 py-0.5 rounded font-mono">{"{{base_url}}/api/{{api_version}}/users"}</code>
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Authorization Tab */}
                  <TabsContent value="auth" className="mt-0">
                    <AuthorizationEditor
                      auth={env.auth || { type: "none" }}
                      onChange={auth => handleUpdateEnvironment(env.environment_id, { auth })}
                      envId={env.environment_id}
                    />
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="mt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Environment Name</Label>
                        <Input
                          value={env.name}
                          onChange={e => handleUpdateEnvironment(env.environment_id, { name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={env.type}
                          onValueChange={v => handleUpdateEnvironment(env.environment_id, { type: v as any })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="staging">Staging</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Base URL</Label>
                        <Input
                          value={env.base_url}
                          onChange={e => handleUpdateEnvironment(env.environment_id, { base_url: e.target.value })}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    {env.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(env.created_at).toLocaleString()}
                        {env.updated_at && ` | Updated: ${new Date(env.updated_at).toLocaleString()}`}
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            )}
          </Card>
        );
      })}

      {environments.length === 0 && !showNewForm && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Globe className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-2">No environments configured</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create environments to manage variables like client_id, api_key, base_url across Dev/Staging/Prod
            </p>
            <Button onClick={() => setShowNewForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create First Environment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Authorization Editor Sub-component ---
function AuthorizationEditor({
  auth,
  onChange,
  envId,
}: {
  auth: NonNullable<EnvironmentConfig["auth"]>;
  onChange: (auth: NonNullable<EnvironmentConfig["auth"]>) => void;
  envId: string;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [tokenResult, setTokenResult] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  const fetchOAuth2Token = async () => {
    if (!auth.oauth2_token_url || !auth.oauth2_client_id) {
      toast({ title: "Error", description: "Token URL and Client ID required", variant: "destructive" });
      return;
    }
    setFetching(true);
    try {
      const body = new URLSearchParams();
      body.append("grant_type", auth.oauth2_grant_type || "client_credentials");
      body.append("client_id", auth.oauth2_client_id);
      if (auth.oauth2_client_secret) body.append("client_secret", auth.oauth2_client_secret);
      if (auth.oauth2_scopes) body.append("scope", auth.oauth2_scopes);
      if (auth.oauth2_grant_type === "password") {
        if (auth.oauth2_username) body.append("username", auth.oauth2_username);
        if (auth.oauth2_password) body.append("password", auth.oauth2_password);
      }

      const resp = await fetch(auth.oauth2_token_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await resp.json();
      if (data.access_token) {
        setTokenResult(data.access_token);
        onChange({ ...auth, bearer_token: data.access_token });
        toast({ title: "Token Acquired", description: `Token expires in ${data.expires_in || "unknown"}s` });
      } else {
        setTokenResult(null);
        toast({ title: "Failed", description: data.error_description || "Could not get token", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium">Authorization Type</Label>
        <Select value={auth.type} onValueChange={v => onChange({ ...auth, type: v as any })}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Auth</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="api_key">API Key</SelectItem>
            <SelectItem value="oauth2">OAuth 2.0</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {auth.type === "bearer" && (
        <div className="space-y-2">
          <Label className="text-xs">Token</Label>
          <Input
            className="font-mono text-sm"
            type={showSecret ? "text" : "password"}
            placeholder="Enter bearer token or use {{variable}}"
            value={auth.bearer_token || ""}
            onChange={e => onChange({ ...auth, bearer_token: e.target.value })}
          />
          <Button variant="ghost" size="sm" onClick={() => setShowSecret(!showSecret)}>
            {showSecret ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
            {showSecret ? "Hide" : "Show"} Token
          </Button>
        </div>
      )}

      {auth.type === "basic" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input value={auth.basic_username || ""} onChange={e => onChange({ ...auth, basic_username: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Password</Label>
            <Input type="password" value={auth.basic_password || ""} onChange={e => onChange({ ...auth, basic_password: e.target.value })} />
          </div>
        </div>
      )}

      {auth.type === "api_key" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Key Name</Label>
              <Input placeholder="X-API-Key" value={auth.api_key_name || ""} onChange={e => onChange({ ...auth, api_key_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Key Value</Label>
              <Input type="password" className="font-mono" value={auth.api_key_value || ""} onChange={e => onChange({ ...auth, api_key_value: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Add To</Label>
            <Select value={auth.api_key_location || "header"} onValueChange={v => onChange({ ...auth, api_key_location: v as any })}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query Parameter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {auth.type === "oauth2" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">OAuth 2.0 Configuration</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Grant Type</Label>
            <Select value={auth.oauth2_grant_type || "client_credentials"} onValueChange={v => onChange({ ...auth, oauth2_grant_type: v as any })}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client_credentials">Client Credentials</SelectItem>
                <SelectItem value="password">Resource Owner Password</SelectItem>
                <SelectItem value="authorization_code">Authorization Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Token URL *</Label>
              <Input
                className="font-mono text-xs"
                placeholder="https://auth.example.com/oauth/token"
                value={auth.oauth2_token_url || ""}
                onChange={e => onChange({ ...auth, oauth2_token_url: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scopes</Label>
              <Input
                placeholder="read write admin"
                value={auth.oauth2_scopes || ""}
                onChange={e => onChange({ ...auth, oauth2_scopes: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client ID *</Label>
              <Input
                className="font-mono text-xs"
                placeholder="your-client-id"
                value={auth.oauth2_client_id || ""}
                onChange={e => onChange({ ...auth, oauth2_client_id: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client Secret</Label>
              <Input
                className="font-mono text-xs"
                type="password"
                placeholder="your-client-secret"
                value={auth.oauth2_client_secret || ""}
                onChange={e => onChange({ ...auth, oauth2_client_secret: e.target.value })}
              />
            </div>
          </div>

          {(auth.oauth2_grant_type === "password") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Username</Label>
                <Input value={auth.oauth2_username || ""} onChange={e => onChange({ ...auth, oauth2_username: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password</Label>
                <Input type="password" value={auth.oauth2_password || ""} onChange={e => onChange({ ...auth, oauth2_password: e.target.value })} />
              </div>
            </div>
          )}

          <Button
            size="sm"
            onClick={fetchOAuth2Token}
            disabled={fetching}
            className="bg-blue-600 hover:bg-blue-500"
          >
            {fetching ? "Fetching..." : "Get New Access Token"}
          </Button>

          {tokenResult && (
            <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
              <p className="text-xs text-green-600 font-medium">Token acquired successfully</p>
              <code className="text-xs text-green-700 break-all block mt-1">
                {tokenResult.substring(0, 50)}...
              </code>
            </div>
          )}
        </div>
      )}

      {auth.type !== "none" && (
        <div className="p-2 rounded bg-muted/50 border border-dashed mt-2">
          <p className="text-xs text-muted-foreground">
            This auth configuration will be automatically applied to all requests using this environment.
            Individual requests can override this.
          </p>
        </div>
      )}
    </div>
  );
}

// Helper to convert EnvVariable[] to {key: value} dict for backend
export function envVarsToDict(vars: EnvVariable[]): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const v of vars) {
    if (v.enabled && v.key.trim()) dict[v.key] = v.value;
  }
  return dict;
}

// Resolve {{variable}} placeholders in a string using environment variables
export function resolveVariables(template: string, env: EnvironmentConfig | null): string {
  if (!env || !template) return template;
  let resolved = template;

  // Always resolve base_url
  resolved = resolved.replace(/\{\{base_url\}\}/g, env.base_url || "");
  resolved = resolved.replace(/\$\{base_url\}/g, env.base_url || "");

  // Resolve all env variables
  const vars = normalizeVariables(env.variables);
  for (const v of vars) {
    if (!v.enabled || !v.key.trim()) continue;
    const escapedKey = v.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    resolved = resolved.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g"), v.value);
    resolved = resolved.replace(new RegExp(`\\$\\{${escapedKey}\\}`, "g"), v.value);
  }

  return resolved;
}

// Check if a string contains unresolved variables
export function hasUnresolvedVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map(m => m.replace(/\{\{|\}\}/g, ""));
}

export { normalizeVariables };
