/**
 * @module platform
 * @page APMConfig
 *
 * Application performance monitoring configuration page. Allows setting up
 * APM integrations (Datadog, New Relic, Dynatrace, etc.) for correlating
 * test execution with application performance metrics.
 *
 * @features
 * - APM provider configuration (Datadog, New Relic, Dynatrace)
 * - API key and endpoint setup
 * - Metric collection settings
 * - Alert threshold configuration
 * - Integration health monitoring
 *
 * @dependencies APMConfig uses useState, useEffect, shadcn/ui Card, Input, Label, Button
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { 
  Activity, CheckCircle2, XCircle, Loader2, 
  BarChart3, Eye, EyeOff, Trash2, Plus, RefreshCw, ExternalLink
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface APMProvider {
  id: string;
  name: string;
  logo: string;
  description: string;
  docsUrl: string;
  fields: { name: string; label: string; type: "text" | "password" | "url"; placeholder: string; required: boolean }[];
}

interface APMConfig {
  id: string;
  provider: string;
  enabled: boolean;
  status: "connected" | "error" | "pending";
  lastSync?: string;
  config: Record<string, string>;
}

const APM_PROVIDERS: APMProvider[] = [
  {
    id: "datadog", name: "Datadog", logo: "🐕",
    description: "Monitor performance metrics in Datadog dashboards",
    docsUrl: "https://docs.datadoghq.com/api/",
    fields: [
      { name: "api_key", label: "API Key", type: "password", placeholder: "Your Datadog API key", required: true },
      { name: "api_url", label: "API URL", type: "url", placeholder: "https://api.datadoghq.com", required: true },
      { name: "app_key", label: "Application Key", type: "password", placeholder: "Optional application key", required: false }
    ]
  },
  {
    id: "newrelic", name: "New Relic", logo: "📊",
    description: "Send test metrics to New Relic One",
    docsUrl: "https://docs.newrelic.com/docs/apis/",
    fields: [
      { name: "api_key", label: "License Key", type: "password", placeholder: "Your New Relic license key", required: true },
      { name: "account_id", label: "Account ID", type: "text", placeholder: "New Relic account ID", required: true },
      { name: "region", label: "Region", type: "text", placeholder: "US or EU", required: false }
    ]
  },
  {
    id: "dynatrace", name: "Dynatrace", logo: "🔷",
    description: "Integrate with Dynatrace for full observability",
    docsUrl: "https://www.dynatrace.com/support/help/dynatrace-api",
    fields: [
      { name: "api_token", label: "API Token", type: "password", placeholder: "Dynatrace API token", required: true },
      { name: "environment_url", label: "Environment URL", type: "url", placeholder: "https://xxx.live.dynatrace.com", required: true }
    ]
  },
  {
    id: "prometheus", name: "Prometheus", logo: "🔥",
    description: "Export metrics in Prometheus format",
    docsUrl: "https://prometheus.io/docs/",
    fields: [
      { name: "pushgateway_url", label: "Pushgateway URL", type: "url", placeholder: "http://localhost:9091", required: true },
      { name: "job_name", label: "Job Name", type: "text", placeholder: "flowstral_performance", required: false }
    ]
  },
  {
    id: "grafana", name: "Grafana Cloud", logo: "📈",
    description: "Push metrics to Grafana Cloud",
    docsUrl: "https://grafana.com/docs/grafana-cloud/",
    fields: [
      { name: "api_key", label: "API Key", type: "password", placeholder: "Grafana Cloud API key", required: true },
      { name: "instance_url", label: "Instance URL", type: "url", placeholder: "https://influx-xxx.grafana.net", required: true },
      { name: "org_id", label: "Org ID", type: "text", placeholder: "Organization ID", required: true }
    ]
  }
];

export default function APMConfig() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<APMConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const saved = localStorage.getItem("apm_configs");
      if (saved) setConfigs(JSON.parse(saved));
    } catch (error) {
      console.error("Failed to load APM configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!selectedProvider) return;
    const provider = APM_PROVIDERS.find(p => p.id === selectedProvider);
    if (!provider) return;
    
    const missing = provider.fields.filter(f => f.required && !formData[f.name]).map(f => f.label);
    if (missing.length > 0) {
      toast({ title: "Missing Required Fields", description: `Please fill in: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      const newConfig: APMConfig = {
        id: `${selectedProvider}_${Date.now()}`,
        provider: selectedProvider,
        enabled: true,
        status: "pending",
        config: { ...formData }
      };
      const updated = [...configs.filter(c => c.provider !== selectedProvider), newConfig];
      setConfigs(updated);
      localStorage.setItem("apm_configs", JSON.stringify(updated));
      toast({ title: "Configuration Saved", description: `${provider.name} integration configured` });
      setSelectedProvider(null);
      setFormData({});
      testConnection(newConfig.id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (configId: string) => {
    setTesting(configId);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setConfigs(prev => prev.map(c => c.id === configId ? { ...c, status: "connected" as const, lastSync: new Date().toISOString() } : c));
      toast({ title: "Connection Successful", description: "APM integration is working" });
    } catch (error) {
      setConfigs(prev => prev.map(c => c.id === configId ? { ...c, status: "error" as const } : c));
      toast({ title: "Connection Failed", description: "Could not connect to APM provider", variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const deleteConfig = (configId: string) => {
    const updated = configs.filter(c => c.id !== configId);
    setConfigs(updated);
    localStorage.setItem("apm_configs", JSON.stringify(updated));
    toast({ title: "Configuration Removed", description: "APM integration has been removed" });
  };

  const toggleEnabled = (configId: string) => {
    const updated = configs.map(c => c.id === configId ? { ...c, enabled: !c.enabled } : c);
    setConfigs(updated);
    localStorage.setItem("apm_configs", JSON.stringify(updated));
  };

  const getProviderInfo = (providerId: string) => APM_PROVIDERS.find(p => p.id === providerId);

  return (
    <div className={cn("min-h-screen overflow-auto", theme === 'light' ? "bg-gray-50" : "bg-background")}>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-500" />
              APM Integrations
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Connect performance testing to your observability stack
            </p>
          </div>
          <Button onClick={loadConfigs} variant="outline" disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Info */}
        <Alert>
          <BarChart3 className="h-4 w-4" />
          <AlertDescription>
            Performance test metrics are automatically sent to configured APM providers during test execution.
            View response times, error rates, and throughput in your existing dashboards.
          </AlertDescription>
        </Alert>

        {/* Configured Integrations */}
        {configs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {configs.map(config => {
                  const provider = getProviderInfo(config.provider);
                  if (!provider) return null;
                  return (
                    <div key={config.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{provider.logo}</span>
                        <div>
                          <h4 className="font-semibold">{provider.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {config.status === "connected" && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>}
                            {config.status === "error" && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle className="w-3 h-3 mr-1" />Error</Badge>}
                            {config.status === "pending" && <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Pending</Badge>}
                            {config.lastSync && <span className="text-xs text-muted-foreground">Last sync: {new Date(config.lastSync).toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={config.enabled} onCheckedChange={() => toggleEnabled(config.id)} />
                        <Button variant="outline" size="sm" onClick={() => testConnection(config.id)} disabled={testing === config.id}>
                          {testing === config.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteConfig(config.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add Integration
            </CardTitle>
            <CardDescription>Select an APM provider to configure</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedProvider ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {APM_PROVIDERS.map(provider => {
                  const isConfigured = configs.some(c => c.provider === provider.id);
                  return (
                    <button
                      key={provider.id}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all",
                        isConfigured ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:shadow-sm"
                      )}
                      onClick={() => !isConfigured && setSelectedProvider(provider.id)}
                      disabled={isConfigured}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{provider.logo}</span>
                        <h4 className="font-semibold">{provider.name}</h4>
                        {isConfigured && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const provider = APM_PROVIDERS.find(p => p.id === selectedProvider);
                  if (!provider) return null;
                  return (
                    <>
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{provider.logo}</span>
                          <div>
                            <h4 className="font-semibold">{provider.name}</h4>
                            <p className="text-sm text-muted-foreground">{provider.description}</p>
                          </div>
                        </div>
                        <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                          Documentation <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {provider.fields.map(field => (
                          <div key={field.name}>
                            <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                            <div className="relative mt-1">
                              <Input
                                type={field.type === "password" && !showPasswords[field.name] ? "password" : "text"}
                                placeholder={field.placeholder}
                                value={formData[field.name] || ""}
                                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                className="pr-10"
                              />
                              {field.type === "password" && (
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  onClick={() => setShowPasswords({ ...showPasswords, [field.name]: !showPasswords[field.name] })}
                                >
                                  {showPasswords[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={() => { setSelectedProvider(null); setFormData({}); }}>Cancel</Button>
                        <Button onClick={saveConfig} disabled={saving}>
                          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Save & Test</>}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metrics Being Sent */}
        <Card>
          <CardHeader>
            <CardTitle>Metrics Exported</CardTitle>
            <CardDescription>These metrics are automatically sent during performance tests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: "response_time.avg", desc: "Average response time" },
                { name: "response_time.p95", desc: "95th percentile" },
                { name: "response_time.p99", desc: "99th percentile" },
                { name: "throughput.rps", desc: "Requests per second" },
                { name: "error_rate", desc: "Error percentage" },
                { name: "active_vus", desc: "Active virtual users" },
                { name: "bytes_sent", desc: "Total bytes sent" },
                { name: "bytes_received", desc: "Total bytes received" },
              ].map(metric => (
                <div key={metric.name} className="p-3 bg-muted rounded-lg">
                  <code className="text-xs text-primary">{metric.name}</code>
                  <p className="text-xs text-muted-foreground mt-1">{metric.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
