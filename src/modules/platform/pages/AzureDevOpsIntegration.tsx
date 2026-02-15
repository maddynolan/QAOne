/**
 * @module platform
 * @page AzureDevOpsIntegration
 *
 * Azure DevOps integration configuration page. Connects to Azure DevOps
 * for work item sync, pipeline triggers, and test result reporting.
 *
 * @features
 * - Azure DevOps organization and project connection
 * - Work item sync (user stories, bugs)
 * - Pipeline trigger configuration
 * - Test result push to Azure Test Plans
 * - Connection health monitoring
 *
 * @dependencies AzureDevOpsIntegration uses lucide-react, shadcn/ui Card, Badge, Button, Input
 */
import { Settings, CheckCircle, XCircle, ExternalLink, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface AzureDevOpsConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
  webhookUrl: string;
}

export default function AzureDevOpsIntegration() {
  const [config, setConfig] = useState<AzureDevOpsConfig>({
    organization: "",
    project: "",
    personalAccessToken: "",
    webhookUrl: `${API_BASE_URL}/integrations/azure-devops/webhook`
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [workItems, setWorkItems] = useState<any[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const savedConfig = localStorage.getItem("azure_devops_config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfig(parsed);
      if (parsed.organization && parsed.personalAccessToken) {
        testConnection();
      }
    }
  };

  const testConnection = async () => {
    if (!config.organization || !config.personalAccessToken) {
      toast.error("Please enter organization and PAT");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/integrations/azure-devops/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: config.organization,
          project: config.project,
          pat: config.personalAccessToken
        })
      });

      if (response.ok) {
        setIsConnected(true);
        toast.success("Successfully connected to Azure DevOps!");
        loadWorkItems();
      } else {
        setIsConnected(false);
        toast.error("Failed to connect to Azure DevOps");
      }
    } catch (error: any) {
      toast.error(`Connection test failed: ${error.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem("azure_devops_config", JSON.stringify(config));
    toast.success("Configuration saved!");
    testConnection();
  };

  const loadWorkItems = async () => {
    if (!config.organization || !config.project) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/integrations/azure-devops/work-items?org=${config.organization}&project=${config.project}`,
        {
          headers: {
            "Authorization": `Bearer ${config.personalAccessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setWorkItems(data.workItems || []);
      }
    } catch (error: any) {
      console.error("Failed to load work items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Azure DevOps Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect Azure DevOps to sync work items and link to test cases
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Configure your Azure DevOps organization and personal access token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ado-org">Organization</Label>
            <Input
              id="ado-org"
              placeholder="your-organization"
              value={config.organization}
              onChange={(e) => setConfig({ ...config, organization: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Your Azure DevOps organization name
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ado-project">Project</Label>
            <Input
              id="ado-project"
              placeholder="your-project"
              value={config.project}
              onChange={(e) => setConfig({ ...config, project: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ado-pat">Personal Access Token</Label>
            <Input
              id="ado-pat"
              type="password"
              placeholder="Enter PAT"
              value={config.personalAccessToken}
              onChange={(e) => setConfig({ ...config, personalAccessToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Create a PAT with <code>Work Items (Read & Write)</code> permissions
            </p>
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

      {isConnected && workItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Work Items</CardTitle>
            <CardDescription>Recent work items from your project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workItems.slice(0, 10).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Workflow className="h-4 w-4" />
                    <div>
                      <p className="font-medium">{item.title || `Work Item ${item.id}`}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.workItemType} - {item.state}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{item.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Work Item Sync</p>
                <p className="text-sm text-muted-foreground">
                  Sync user stories and requirements
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Test Case Linking</p>
                <p className="text-sm text-muted-foreground">
                  Link test cases to work items
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Webhook Support</p>
                <p className="text-sm text-muted-foreground">
                  Receive real-time work item updates
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Traceability</p>
                <p className="text-sm text-muted-foreground">
                  Track requirements to test cases
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



