import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIConfiguration } from "@/components/AIConfiguration";
import { PluginManagement } from "@/components/PluginManagement";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Settings2, Puzzle, Brain, Bell, Database, Shield, Download, Monitor, Chrome } from "lucide-react";

const AI_TASKS = [
  { value: "jira-to-tests", label: "Jira to Test Cases" },
  { value: "testcase-to-playwright", label: "Test Case to Playwright" },
  { value: "api-tests", label: "API Tests Generation" },
  { value: "perf-tests", label: "Performance Tests" },
  { value: "a11y-tests", label: "Accessibility Tests" },
  { value: "triage", label: "Test Failure Triage" },
];

export default function Settings() {
  const [selectedTask, setSelectedTask] = useState("jira-to-tests");
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, [selectedTask]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/ai/templates?project_id=default&task=${selectedTask}`
      );
      const data = await response.json();
      setTemplate(data.template || "");
    } catch (error) {
      console.error("Error loading template:", error);
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const response = await fetch("http://localhost:8000/ai/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "default",
          task: selectedTask,
          template: template,
        }),
      });

      const data = await response.json();
      if (data.status === "success") {
        toast.success("Template saved successfully!");
      } else {
        toast.error("Failed to save template");
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your Flowstral configuration and plugins</p>
      </div>

      <Tabs defaultValue="plugins" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="plugins" className="flex items-center gap-2">
            <Puzzle className="w-4 h-4" />
            <span className="hidden sm:inline">Plugins</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          <TabsTrigger value="downloads" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Downloads</span>
          </TabsTrigger>
        </TabsList>

        {/* PLUGINS TAB - Primary entry point for plugin management */}
        <TabsContent value="plugins" className="space-y-6">
          <PluginManagement />
        </TabsContent>

        {/* AI TAB */}
        <TabsContent value="ai" className="space-y-6 max-w-4xl">
          <AIConfiguration />

          <Card>
            <CardHeader>
              <CardTitle>AI Prompt Templates</CardTitle>
              <CardDescription>
                Customize AI prompts for different tasks. Edit templates to control how AI generates tests and analyzes failures.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-task">AI Task</Label>
                <Select value={selectedTask} onValueChange={setSelectedTask}>
                  <SelectTrigger id="ai-task">
                    <SelectValue placeholder="Select AI task" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_TASKS.map((task) => (
                      <SelectItem key={task.value} value={task.value}>
                        {task.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-template">Prompt Template</Label>
                <Textarea
                  id="prompt-template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Enter your prompt template..."
                  className="font-mono text-sm min-h-[300px]"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{variable}"} placeholders in your template. Variables like {"{requirements}"}, {"{test_case}"}, {"{logs}"} will be replaced with actual data.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={loadTemplate} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Reset
                </Button>
                <Button onClick={saveTemplate} disabled={saving || loading}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure basic platform settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input id="org-name" placeholder="Your Organization" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-endpoint">API Endpoint</Label>
                <Input id="api-endpoint" placeholder="https://api.example.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
              <CardDescription>Configure default test execution settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Parallel Execution</Label>
                  <p className="text-sm text-muted-foreground">Run tests in parallel for faster execution</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Retry Failed Tests</Label>
                  <p className="text-sm text-muted-foreground">Automatically retry failed tests once</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="timeout">Default Timeout (seconds)</Label>
                <Input id="timeout" type="number" defaultValue="30" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications" className="space-y-6 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Manage notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email alerts for test failures</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Slack Integration</Label>
                  <p className="text-sm text-muted-foreground">Send notifications to Slack</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>In-App Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show desktop notifications for test events</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DATA TAB */}
        <TabsContent value="data" className="space-y-6 max-w-4xl">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Data Management</CardTitle>
              <CardDescription>Manage local data storage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clear All Local Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Remove all locally stored data (releases, plans, runs, test cases, requirements, defects)
                  </p>
                </div>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Are you sure you want to clear ALL local data?\n\nThis will delete:\n- Releases\n- Test Plans\n- Test Runs\n- Test Cases (local)\n- Requirements (local)\n- Defects (local)\n\nThis cannot be undone!')) {
                      // Clear all localStorage
                      localStorage.clear();
                      sessionStorage.clear();
                      toast.success('All local data cleared');
                      // Reload to reset state
                      setTimeout(() => window.location.reload(), 500);
                    }
                  }}
                >
                  Clear All Data
                </Button>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Currently stored:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Releases: {JSON.parse(localStorage.getItem('releases') || '[]').length}</li>
                  <li>Test Plans: {JSON.parse(localStorage.getItem('test_plans') || '[]').length}</li>
                  <li>Test Runs: {JSON.parse(localStorage.getItem('test_runs') || '[]').length}</li>
                  <li>Test Cases: {JSON.parse(localStorage.getItem('test_cases') || '[]').length}</li>
                  <li>Requirements: {JSON.parse(localStorage.getItem('requirements') || '[]').length}</li>
                  <li>Defects: {JSON.parse(localStorage.getItem('defects') || '[]').length}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Export your data for backup or migration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export All Tests</Label>
                  <p className="text-sm text-muted-foreground">Download all test cases as JSON</p>
                </div>
                <Button variant="outline">Export</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export Test Results</Label>
                  <p className="text-sm text-muted-foreground">Download test run history as CSV</p>
                </div>
                <Button variant="outline">Export</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOWNLOADS TAB */}
        <TabsContent value="downloads" className="space-y-6 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Desktop App
              </CardTitle>
              <CardDescription>
                Download the Flowstral desktop app for the best recording and playback experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">Flowstral Desktop for Windows</p>
                  <p className="text-sm text-muted-foreground">Version 2.0.0 • ~90 MB</p>
                </div>
                <Button 
                  onClick={() => window.open('https://github.com/maddynolan/QAOne/releases/latest/download/Flowstral.Setup.2.0.0.exe', '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg opacity-60">
                <div className="space-y-1">
                  <p className="font-medium">Flowstral Desktop for macOS</p>
                  <p className="text-sm text-muted-foreground">Coming Soon</p>
                </div>
                <Button disabled>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="w-5 h-5" />
                Browser Extension
              </CardTitle>
              <CardDescription>
                Install the Chrome extension for quick in-browser test recording
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">Flowstral Chrome Extension</p>
                  <p className="text-sm text-muted-foreground">Record tests directly in your browser</p>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.open('https://chrome.google.com/webstore/detail/flowstral', '_blank')}
                >
                  <Chrome className="w-4 h-4 mr-2" />
                  Add to Chrome
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                License Activation
              </CardTitle>
              <CardDescription>
                How to activate your license in the desktop app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Download and install the desktop app</li>
                <li>Open the app and go to <strong className="text-foreground">Settings → License</strong></li>
                <li>Enter your license key and click <strong className="text-foreground">Activate</strong></li>
              </ol>
              <p className="text-sm text-muted-foreground mt-4">
                Don't have a license key? Contact your administrator or check your email.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
