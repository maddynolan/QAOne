/**
 * @module platform
 * @page SecretsVault
 *
 * Credential and secrets management page. Provides a secure vault for
 * storing API keys, passwords, tokens, and other sensitive data used
 * in test execution and integrations.
 *
 * @features
 * - Secure secret storage with encryption
 * - Secret CRUD operations with masking
 * - Environment-scoped secrets
 * - Secret usage auditing
 * - Import/export with encryption
 *
 * @api /api/secrets/* - Secrets vault management
 *
 * @dependencies SecretsVault uses useState, useEffect, shadcn/ui Card, Input, Label, Button
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { 
  Key, Lock, Eye, EyeOff, Plus, Trash2, Copy, Shield,
  RefreshCw, Search, Loader2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_BASE_URL } from '@/lib/api-config';

interface Secret {
  secret_id: string;
  name: string;
  secret_type: string;
  description?: string;
  environment?: string;
  project_id?: string;
  masked_value: string;
  created_at: string;
  updated_at?: string;
}

const SECRET_TYPES = [
  { value: "api_key", label: "API Key", icon: "🔑" },
  { value: "password", label: "Password", icon: "🔒" },
  { value: "token", label: "Auth Token", icon: "🎫" },
  { value: "credential", label: "Credential", icon: "👤" },
  { value: "connection_string", label: "Connection String", icon: "🔗" },
  { value: "certificate", label: "Certificate", icon: "📜" },
  { value: "custom", label: "Custom", icon: "📦" },
];

const ENVIRONMENTS = [
  { value: "dev", label: "Development", color: "bg-blue-500" },
  { value: "qa", label: "QA", color: "bg-yellow-500" },
  { value: "staging", label: "Staging", color: "bg-orange-500" },
  { value: "prod", label: "Production", color: "bg-red-500" },
];

export default function SecretsVault() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEnv, setFilterEnv] = useState<string>("all");
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSecret, setNewSecret] = useState({
    name: "",
    value: "",
    secret_type: "api_key",
    description: "",
    environment: "dev"
  });
  const [showValue, setShowValue] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    loadSecrets();
  }, []);

  const loadSecrets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("secret_type", filterType);
      if (filterEnv !== "all") params.append("environment", filterEnv);
      
      const response = await fetch(`${API_BASE_URL}/api/secrets/?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSecrets(data.secrets || []);
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load secrets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createSecret = async () => {
    if (!newSecret.name || !newSecret.value) {
      toast({ title: "Validation Error", description: "Name and value are required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/secrets/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSecret)
      });
      if (response.ok) {
        toast({ title: "Secret Created", description: `Secret "${newSecret.name}" stored securely` });
        setShowCreateDialog(false);
        setNewSecret({ name: "", value: "", secret_type: "api_key", description: "", environment: "dev" });
        loadSecrets();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const deleteSecret = async (secretId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await fetch(`${API_BASE_URL}/api/secrets/${secretId}`, { method: "DELETE" });
      toast({ title: "Deleted", description: `Secret "${name}" removed` });
      loadSecrets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const revealSecret = async (secretId: string) => {
    setRevealing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/secrets/${secretId}?reveal=true`);
      if (response.ok) {
        const data = await response.json();
        setRevealedValue(data.secret?.value || "");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setRevealing(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const filteredSecrets = secrets.filter(secret => {
    const matchesSearch = !searchTerm || 
      secret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      secret.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getTypeIcon = (type: string) => SECRET_TYPES.find(t => t.value === type)?.icon || "📦";

  const getEnvBadge = (env?: string) => {
    const found = ENVIRONMENTS.find(e => e.value === env);
    if (!found) return null;
    return <Badge className={`${found.color} text-white`}>{found.label}</Badge>;
  };

  return (
    <div className={cn(
      "min-h-screen overflow-auto",
      theme === 'light' ? "bg-gray-50" : "bg-background"
    )}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-500" />
              Secrets Vault
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Securely store and manage API keys, passwords, and sensitive test data
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Secret
          </Button>
        </div>

        {/* Info Alert */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            All secrets are encrypted at rest using AES-256 encryption. Values are only decrypted when explicitly requested.
          </AlertDescription>
        </Alert>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label>Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-40">
                <Label>Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {SECRET_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.icon} {type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label>Environment</Label>
                <Select value={filterEnv} onValueChange={setFilterEnv}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    {ENVIRONMENTS.map(env => (
                      <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={loadSecrets} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Secrets Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Stored Secrets ({filteredSecrets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSecrets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No secrets stored yet</p>
                <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                  Add your first secret
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSecrets.map((secret) => (
                      <TableRow key={secret.secret_id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{secret.name}</span>
                            {secret.description && <p className="text-xs text-muted-foreground">{secret.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getTypeIcon(secret.secret_type)} {secret.secret_type}</Badge>
                        </TableCell>
                        <TableCell>{getEnvBadge(secret.environment)}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{secret.masked_value}</code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(secret.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedSecret(secret); setRevealedValue(null); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`{{${secret.name}}}`, "Variable reference")}>
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteSecret(secret.secret_id, secret.name)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Usage Guide */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use Secrets in Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold text-sm mb-2">In API Tests</h4>
                <code className="text-xs block bg-background p-2 rounded">Authorization: Bearer {`{{API_TOKEN}}`}</code>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold text-sm mb-2">In Environment Variables</h4>
                <code className="text-xs block bg-background p-2 rounded">DB_PASSWORD={`{{db_password}}`}</code>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold text-sm mb-2">In Test Scripts</h4>
                <code className="text-xs block bg-background p-2 rounded">await secrets.resolve("api_key")</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Secret
            </DialogTitle>
            <DialogDescription>
              Secrets are encrypted at rest and can be referenced using {`{{secret_name}}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input placeholder="e.g., API_KEY" value={newSecret.name} onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value })} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Use as: {`{{${newSecret.name || 'secret_name'}}}`}</p>
            </div>
            <div>
              <Label>Value *</Label>
              <div className="relative mt-1">
                <Input type={showValue ? "text" : "password"} placeholder="Enter secret value" value={newSecret.value} onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })} className="pr-10" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowValue(!showValue)}>
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={newSecret.secret_type} onValueChange={(v) => setNewSecret({ ...newSecret, secret_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECRET_TYPES.map(type => (<SelectItem key={type.value} value={type.value}>{type.icon} {type.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Environment</Label>
                <Select value={newSecret.environment} onValueChange={(v) => setNewSecret({ ...newSecret, environment: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map(env => (<SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Optional description" value={newSecret.description} onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createSecret} disabled={creating}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Lock className="w-4 h-4 mr-2" />Store Secret</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Secret Dialog */}
      <Dialog open={!!selectedSecret} onOpenChange={() => { setSelectedSecret(null); setRevealedValue(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              {selectedSecret?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedSecret && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <p>{getTypeIcon(selectedSecret.secret_type)} {selectedSecret.secret_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Environment</Label>
                  <div className="mt-1">{getEnvBadge(selectedSecret.environment)}</div>
                </div>
              </div>
              {selectedSecret.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedSecret.description}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Value</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">{revealedValue || selectedSecret.masked_value}</code>
                  {revealedValue ? (
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(revealedValue, "Secret value")}><Copy className="w-4 h-4" /></Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => revealSecret(selectedSecret.secret_id)} disabled={revealing}>
                      {revealing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Use in Tests</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded text-green-600 dark:text-green-400">{`{{${selectedSecret.name}}}`}</code>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(`{{${selectedSecret.name}}}`, "Variable reference")}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedSecret(null); setRevealedValue(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
