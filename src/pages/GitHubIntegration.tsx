import { Settings, Code, GitBranch, CheckCircle, XCircle, ExternalLink, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  webhookSecret: string;
  webhookUrl: string;
}

export default function GitHubIntegration() {
  const [config, setConfig] = useState<GitHubConfig>({
    token: "",
    owner: "",
    repo: "",
    webhookSecret: "",
    webhookUrl: `${API_BASE_URL}/github/webhook`
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repositories, setRepositories] = useState<any[]>([]);
  const [webhookEnabled, setWebhookEnabled] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const savedConfig = localStorage.getItem("github_config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfig(parsed);
      if (parsed.token && parsed.owner) {
        testConnection();
      }
    }
  };

  const testConnection = async () => {
    if (!config.token || !config.owner) {
      toast.error("Please enter GitHub token and owner");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/github/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: config.token,
          owner: config.owner
        })
      });

      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);
        setRepositories(data.repositories || []);
        toast.success("Successfully connected to GitHub!");
      } else {
        setIsConnected(false);
        toast.error("Failed to connect to GitHub");
      }
    } catch (error: any) {
      toast.error(`Connection test failed: ${error.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem("github_config", JSON.stringify(config));
    toast.success("Configuration saved!");
    testConnection();
  };

  const setupWebhook = async () => {
    if (!config.token || !config.owner || !config.repo) {
      toast.error("Please configure GitHub connection first");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/github/webhook/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: config.token,
          owner: config.owner,
          repo: config.repo,
          webhook_url: config.webhookUrl,
          secret: config.webhookSecret
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
        <h1 className="text-3xl font-bold gradient-text">GitHub Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your GitHub repositories to sync test code and trigger CI/CD
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Configure your GitHub personal access token and repository
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-token">GitHub Personal Access Token</Label>
            <Input
              id="github-token"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Create a token with <code>repo</code> and <code>admin:repo_hook</code> permissions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="github-owner">Owner/Organization</Label>
              <Input
                id="github-owner"
                placeholder="your-username"
                value={config.owner}
                onChange={(e) => setConfig({ ...config, owner: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-repo">Repository</Label>
              <Input
                id="github-repo"
                placeholder="your-repo"
                value={config.repo}
                onChange={(e) => setConfig({ ...config, repo: e.target.value })}
              />
            </div>
          </div>

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

      {isConnected && repositories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
            <CardDescription>Available repositories in your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {repositories.map((repo: any) => (
                <div key={repo.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Code className="h-4 w-4" />
                    <div>
                      <p className="font-medium">{repo.name}</p>
                      <p className="text-sm text-muted-foreground">{repo.full_name}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Set up webhooks to automatically sync test code and trigger CI/CD
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
              This URL will receive GitHub webhook events
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
            <p className="text-xs text-muted-foreground">
              Secret used to verify webhook payloads
            </p>
          </div>

          <div className="flex items-center justify-between">
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
                <p className="font-medium">Repository Sync</p>
                <p className="text-sm text-muted-foreground">
                  Sync test code from GitHub repositories
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Webhook Support</p>
                <p className="text-sm text-muted-foreground">
                  Receive real-time updates from GitHub
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">CI/CD Triggers</p>
                <p className="text-sm text-muted-foreground">
                  Trigger test runs on push/PR events
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Code Sync</p>
                <p className="text-sm text-muted-foreground">
                  Automatically sync test code changes
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



