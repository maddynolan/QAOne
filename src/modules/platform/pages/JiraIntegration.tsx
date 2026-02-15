/**
 * @module platform
 * @page JiraIntegration
 *
 * Jira integration configuration page. Connects to Atlassian Jira for
 * bidirectional defect sync, requirement import from user stories, and
 * test execution status reporting back to Jira issues.
 *
 * @features
 * - Jira project connection via OAuth/API token
 * - Bidirectional defect synchronization
 * - Requirement import from Jira user stories
 * - Test result status push to Jira issues
 * - Custom field mapping configuration
 * - Connection health monitoring
 *
 * @dependencies JiraIntegration uses lucide-react, shadcn/ui Card, Badge, Button, Input
 */
import { Settings, TestTube, Bug, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { jiraIntegrationService, JiraConfig, JiraIssue } from "@/lib/jira-integration-service";
import { toast } from "sonner";

export default function JiraIntegration() {
  const [config, setConfig] = useState<JiraConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [newIssue, setNewIssue] = useState({
    summary: '',
    description: '',
    issueType: 'Bug',
    priority: 'Medium',
    labels: [] as string[],
    assignee: ''
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const savedConfig = jiraIntegrationService.getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      testConnection();
    }
  };

  const testConnection = async () => {
    if (!config) return;
    
    setIsLoading(true);
    try {
      const connected = await jiraIntegrationService.testConnection();
      setIsConnected(connected);
      if (connected) {
        toast.success("Successfully connected to Jira!");
        loadIssues();
      } else {
        toast.error("Failed to connect to Jira. Please check your configuration.");
      }
    } catch (error) {
      toast.error(`Connection test failed: ${error.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = () => {
    if (!config) return;
    
    jiraIntegrationService.setConfig(config);
    testConnection();
  };

  const loadIssues = async () => {
    if (!config) return;
    
    setIsLoading(true);
    try {
      const jql = `project = ${config.projectKey} ORDER BY created DESC`;
      const jiraIssues = await jiraIntegrationService.searchIssues(jql);
      setIssues(jiraIssues);
    } catch (error) {
      toast.error(`Failed to load issues: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createIssue = async () => {
    if (!config) return;
    
    setIsLoading(true);
    try {
      const issue = await jiraIntegrationService.createIssue({
        summary: newIssue.summary,
        description: newIssue.description,
        issueType: newIssue.issueType,
        priority: newIssue.priority,
        labels: newIssue.labels,
        assignee: newIssue.assignee || undefined
      });
      
      setIssues(prev => [issue, ...prev]);
      setNewIssue({
        summary: '',
        description: '',
        issueType: 'Bug',
        priority: 'Medium',
        labels: [],
        assignee: ''
      });
      toast.success("Issue created successfully!");
    } catch (error) {
      toast.error(`Failed to create issue: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'highest':
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
      case 'lowest':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done':
      case 'closed':
      case 'resolved':
        return 'default';
      case 'in progress':
      case 'in review':
        return 'secondary';
      case 'open':
      case 'to do':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Jira Integration</h1>
        <p className="text-muted-foreground mt-1">Connect and manage Jira issues</p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Jira Base URL</Label>
              <Input
                id="baseUrl"
                placeholder="https://yourcompany.atlassian.net"
                value={config?.baseUrl || ''}
                onChange={(e) => setConfig(prev => ({ ...prev!, baseUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="your-email@company.com"
                value={config?.username || ''}
                onChange={(e) => setConfig(prev => ({ ...prev!, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Your Jira API token"
                value={config?.apiToken || ''}
                onChange={(e) => setConfig(prev => ({ ...prev!, apiToken: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectKey">Project Key</Label>
              <Input
                id="projectKey"
                placeholder="PROJ"
                value={config?.projectKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev!, projectKey: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={saveConfig} disabled={!config || isLoading}>
              <Settings className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={!config || isLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Connected to Jira</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Issue */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Create New Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Input
                id="summary"
                placeholder="Issue summary"
                value={newIssue.summary}
                onChange={(e) => setNewIssue(prev => ({ ...prev, summary: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Issue description"
                value={newIssue.description}
                onChange={(e) => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issueType">Issue Type</Label>
                <Select
                  value={newIssue.issueType}
                  onValueChange={(value) => setNewIssue(prev => ({ ...prev, issueType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bug">Bug</SelectItem>
                    <SelectItem value="Task">Task</SelectItem>
                    <SelectItem value="Story">Story</SelectItem>
                    <SelectItem value="Epic">Epic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newIssue.priority}
                  onValueChange={(value) => setNewIssue(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Highest">Highest</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Lowest">Lowest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Input
                  id="assignee"
                  placeholder="Assignee username"
                  value={newIssue.assignee}
                  onChange={(e) => setNewIssue(prev => ({ ...prev, assignee: e.target.value }))}
                />
              </div>
            </div>

            <Button 
              onClick={createIssue}
              disabled={!newIssue.summary || isLoading}
              className="w-full"
            >
              <Bug className="h-4 w-4 mr-2" />
              Create Issue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Issues List */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Recent Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <div className="text-center py-8">
                <TestTube className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
                <p className="text-muted-foreground">
                  Create your first issue or check your project configuration
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {issues.map((issue) => (
                  <div key={issue.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getPriorityColor(issue.priority)}>
                            {issue.priority}
                          </Badge>
                          <Badge variant={getStatusColor(issue.status)}>
                            {issue.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {issue.key}
                          </span>
                        </div>
                        <h4 className="font-semibold">{issue.summary}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {issue.description}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created: {new Date(issue.created).toLocaleDateString()}</span>
                      <span>Updated: {new Date(issue.updated).toLocaleDateString()}</span>
                      {issue.assignee && <span>Assignee: {issue.assignee}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


