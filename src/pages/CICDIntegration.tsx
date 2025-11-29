import { Settings, CheckCircle, XCircle, GitBranch, Webhook, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface CICDConfig {
  provider: "github-actions" | "jenkins" | "gitlab-ci" | "circle-ci";
  webhookUrl: string;
  webhookSecret: string;
  autoTrigger: boolean;
  githubActions?: {
    repo: string;
    workflow: string;
  };
  jenkins?: {
    url: string;
    job: string;
    token: string;
  };
  gitlab?: {
    project: string;
    pipeline: string;
  };
}

export default function CICDIntegration() {
  const [config, setConfig] = useState<CICDConfig>({
    provider: "github-actions",
    webhookUrl: `${API_BASE_URL}/cicd/webhook`,
    webhookSecret: "",
    autoTrigger: false
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const savedConfig = localStorage.getItem("cicd_config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfig(parsed);
      if (parsed.provider) {
        testConnection();
      }
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/cicd/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: config.provider,
          config: config
        })
      });

      if (response.ok) {
        setIsConnected(true);
        toast.success(`Successfully connected to ${config.provider}!`);
      } else {
        setIsConnected(false);
        toast.error("Failed to connect");
      }
    } catch (error: any) {
      toast.error(`Connection test failed: ${error.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem("cicd_config", JSON.stringify(config));
    toast.success("Configuration saved!");
    testConnection();
  };

  const setupWebhook = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/cicd/webhook/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: config.provider,
          webhook_url: config.webhookUrl,
          secret: config.webhookSecret,
          config: config
        })
      });

      if (response.ok) {
        setWebhookEnabled(true);
        toast.success("Webhook configured successfully!");
      } else {
        toast.error("Failed to setup webhook");
      }
    } catch (error: any) {
      toast.error(`Webhook setup failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">CI/CD Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect CI/CD pipelines to trigger test runs automatically
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Settings</CardTitle>
          <CardDescription>
            Select your CI/CD provider and configure connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cicd-provider">CI/CD Provider</Label>
            <Select
              value={config.provider}
              onValueChange={(value: any) => setConfig({ ...config, provider: value })}
            >
              <SelectTrigger id="cicd-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github-actions">GitHub Actions</SelectItem>
                <SelectItem value="jenkins">Jenkins</SelectItem>
                <SelectItem value="gitlab-ci">GitLab CI</SelectItem>
                <SelectItem value="circle-ci">Circle CI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.provider === "github-actions" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gh-repo">Repository</Label>
                <Input
                  id="gh-repo"
                  placeholder="owner/repo"
                  value={config.githubActions?.repo || ""}
                  onChange={(e) => setConfig({
                    ...config,
                    githubActions: { ...config.githubActions, repo: e.target.value } as any
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gh-workflow">Workflow</Label>
                <Input
                  id="gh-workflow"
                  placeholder="test.yml"
                  value={config.githubActions?.workflow || ""}
                  onChange={(e) => setConfig({
                    ...config,
                    githubActions: { ...config.githubActions, workflow: e.target.value } as any
                  })}
                />
              </div>
            </div>
          )}

          {config.provider === "jenkins" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jenkins-url">Jenkins URL</Label>
                <Input
                  id="jenkins-url"
                  placeholder="https://jenkins.example.com"
                  value={config.jenkins?.url || ""}
                  onChange={(e) => setConfig({
                    ...config,
                    jenkins: { ...config.jenkins, url: e.target.value } as any
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jenkins-job">Job Name</Label>
                  <Input
                    id="jenkins-job"
                    placeholder="test-job"
                    value={config.jenkins?.job || ""}
                    onChange={(e) => setConfig({
                      ...config,
                      jenkins: { ...config.jenkins, job: e.target.value } as any
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jenkins-token">API Token</Label>
                  <Input
                    id="jenkins-token"
                    type="password"
                    placeholder="Enter token"
                    value={config.jenkins?.token || ""}
                    onChange={(e) => setConfig({
                      ...config,
                      jenkins: { ...config.jenkins, token: e.target.value } as any
                    })}
                  />
                </div>
              </div>
            </div>
          )}

          {config.provider === "gitlab-ci" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gitlab-project">Project</Label>
                <Input
                  id="gitlab-project"
                  placeholder="group/project"
                  value={config.gitlab?.project || ""}
                  onChange={(e) => setConfig({
                    ...config,
                    gitlab: { ...config.gitlab, project: e.target.value } as any
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gitlab-pipeline">Pipeline</Label>
                <Input
                  id="gitlab-pipeline"
                  placeholder="pipeline-name"
                  value={config.gitlab?.pipeline || ""}
                  onChange={(e) => setConfig({
                    ...config,
                    gitlab: { ...config.gitlab, pipeline: e.target.value } as any
                  })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={testConnection} disabled={isLoading}>
                Test Connection
              </Button>
              <Button onClick={saveConfig} disabled={isLoading}>
                Save Configuration
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Set up webhooks to trigger test runs automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={config.webhookUrl}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              This URL will receive CI/CD webhook events
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">Webhook Secret</Label>
            <Input
              id="webhook-secret"
              type="password"
              placeholder="Enter webhook secret"
              value={config.webhookSecret}
              onChange={(e) => setConfig({ ...config, webhookSecret: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Trigger Tests</Label>
              <p className="text-sm text-muted-foreground">
                Automatically trigger test runs on CI/CD events
              </p>
            </div>
            <Switch
              checked={config.autoTrigger}
              onCheckedChange={(checked) => setConfig({ ...config, autoTrigger: checked })}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label>Webhook Status</Label>
              <p className="text-sm text-muted-foreground">
                {webhookEnabled ? "Webhook is active" : "Webhook not configured"}
              </p>
            </div>
            <Button onClick={setupWebhook} disabled={isLoading || !isConnected}>
              <Webhook className="h-4 w-4 mr-2" />
              Setup Webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">GitHub Actions</p>
                <p className="text-sm text-muted-foreground">
                  Trigger tests on push/PR events
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Jenkins</p>
                <p className="text-sm text-muted-foreground">
                  Integrate with Jenkins pipelines
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">GitLab CI</p>
                <p className="text-sm text-muted-foreground">
                  Connect to GitLab pipelines
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Webhook Support</p>
                <p className="text-sm text-muted-foreground">
                  Receive CI/CD events via webhooks
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



