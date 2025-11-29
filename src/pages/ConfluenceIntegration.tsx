import { Settings, BookOpen, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey: string;
}

export default function ConfluenceIntegration() {
  const [config, setConfig] = useState<ConfluenceConfig>({
    baseUrl: "",
    username: "",
    apiToken: "",
    spaceKey: ""
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pages, setPages] = useState<any[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const savedConfig = localStorage.getItem("confluence_config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfig(parsed);
      if (parsed.baseUrl && parsed.username && parsed.apiToken) {
        testConnection();
      }
    }
  };

  const testConnection = async () => {
    if (!config.baseUrl || !config.username || !config.apiToken) {
      toast.error("Please enter all connection details");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/integrations/confluence/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: config.baseUrl,
          username: config.username,
          api_token: config.apiToken,
          space_key: config.spaceKey
        })
      });

      if (response.ok) {
        setIsConnected(true);
        toast.success("Successfully connected to Confluence!");
        loadPages();
      } else {
        setIsConnected(false);
        toast.error("Failed to connect to Confluence");
      }
    } catch (error: any) {
      toast.error(`Connection test failed: ${error.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem("confluence_config", JSON.stringify(config));
    toast.success("Configuration saved!");
    testConnection();
  };

  const loadPages = async () => {
    if (!config.baseUrl || !config.spaceKey) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/integrations/confluence/pages?space_key=${config.spaceKey}`,
        {
          headers: {
            "Authorization": `Basic ${btoa(`${config.username}:${config.apiToken}`)}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPages(data.pages || []);
      }
    } catch (error: any) {
      console.error("Failed to load pages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Confluence Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect Confluence to sync documentation and requirements
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Configure your Confluence instance and API credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confluence-url">Confluence Base URL</Label>
            <Input
              id="confluence-url"
              placeholder="https://your-domain.atlassian.net/wiki"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Your Confluence instance URL
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="confluence-username">Username/Email</Label>
              <Input
                id="confluence-username"
                placeholder="user@example.com"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confluence-space">Space Key</Label>
              <Input
                id="confluence-space"
                placeholder="QA"
                value={config.spaceKey}
                onChange={(e) => setConfig({ ...config, spaceKey: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confluence-token">API Token</Label>
            <Input
              id="confluence-token"
              type="password"
              placeholder="Enter API token"
              value={config.apiToken}
              onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Create an API token from your Atlassian account settings
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

      {isConnected && pages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pages</CardTitle>
            <CardDescription>Recent pages from your Confluence space</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pages.slice(0, 10).map((page: any) => (
                <div key={page.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-4 w-4" />
                    <div>
                      <p className="font-medium">{page.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(page.lastModified || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={page.url} target="_blank" rel="noopener noreferrer">
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
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Document Sync</p>
                <p className="text-sm text-muted-foreground">
                  Sync documentation from Confluence
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Requirements Sync</p>
                <p className="text-sm text-muted-foreground">
                  Extract requirements from Confluence pages
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Page Search</p>
                <p className="text-sm text-muted-foreground">
                  Search and link to Confluence pages
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Content Extraction</p>
                <p className="text-sm text-muted-foreground">
                  Extract structured data from pages
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



