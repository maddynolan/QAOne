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
import { API_BASE_URL } from "@/lib/api-config";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Settings2, Puzzle, Brain, Bell, Database, Shield, Download, Monitor, Chrome, Key, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const AI_TASKS = [
  { value: "jira-to-tests", label: "Jira to Test Cases" },
  { value: "testcase-to-playwright", label: "Test Case to Automated Script" },
  { value: "api-tests", label: "API Tests Generation" },
  { value: "perf-tests", label: "Performance Tests" },
  { value: "a11y-tests", label: "Accessibility Tests" },
  { value: "triage", label: "Test Failure Triage" },
];

// License Settings Component - Shows license status and days remaining
function LicenseSettings() {
  const [licenseInfo, setLicenseInfo] = useState<{
    valid: boolean;
    key?: string;
    type?: string;
    expiresAt?: string;
    features?: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    const hasElectron = !!(flowstral || electronAPI);
    setIsElectron(hasElectron);
    
    if (hasElectron) {
      // Get license info from Electron
      const getLicense = async () => {
        try {
          const info = await (flowstral?.getLicenseInfo?.() || electronAPI?.getLicenseInfo?.());
          setLicenseInfo(info || { valid: false });
        } catch (e) {
          setLicenseInfo({ valid: false });
        } finally {
          setIsLoading(false);
        }
      };
      getLicense();
    } else {
      setIsLoading(false);
    }
  }, []);

  const getDaysLeft = () => {
    if (!licenseInfo?.expiresAt) return null;
    const expires = new Date(licenseInfo.expiresAt);
    const now = new Date();
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleActivate = async () => {
    if (!newKey.trim()) {
      toast.error('Please enter a license key');
      return;
    }
    
    setIsActivating(true);
    try {
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      const result = await (
        flowstral?.activateLicense?.(newKey.trim()) || 
        electronAPI?.activateLicense?.(newKey.trim())
      );
      
      if (result?.valid) {
        toast.success('License activated successfully!');
        setLicenseInfo(result);
        setNewKey('');
      } else {
        toast.error(result?.error || 'Invalid license key');
      }
    } catch (e: any) {
      toast.error(e.message || 'Activation failed');
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      await (flowstral?.deactivateLicense?.() || electronAPI?.deactivateLicense?.());
      toast.success('License deactivated');
      setLicenseInfo({ valid: false });
    } catch (e: any) {
      toast.error('Failed to deactivate');
    }
  };

  const daysLeft = getDaysLeft();
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7;
  const isExpired = daysLeft !== null && daysLeft <= 0;

  if (!isElectron) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            License Management
          </CardTitle>
          <CardDescription>
            License management is only available in the desktop app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Download the desktop app to manage your license.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* License Status Card */}
      <Card className={isExpired ? 'border-red-500/50' : isExpiringSoon ? 'border-amber-500/50' : licenseInfo?.valid ? 'border-emerald-500/50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {licenseInfo?.valid && !isExpired ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
            License Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {licenseInfo?.valid && !isExpired ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium text-emerald-500">Active</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{licenseInfo.type || 'Standard'}</p>
                </div>
                {licenseInfo.expiresAt && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Expires</p>
                      <p className="font-medium">{new Date(licenseInfo.expiresAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Days Remaining</p>
                      <p className={`font-medium flex items-center gap-1 ${isExpiringSoon ? 'text-amber-500' : ''}`}>
                        <Clock className="w-4 h-4" />
                        {daysLeft} days
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {isExpiringSoon && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Your license expires soon. Contact support to renew.
                  </p>
                </div>
              )}

              {licenseInfo.key && (
                <div>
                  <p className="text-sm text-muted-foreground">License Key</p>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{licenseInfo.key.substring(0, 20)}...</p>
                </div>
              )}

              <Separator />
              
              <Button variant="outline" onClick={handleDeactivate} className="text-red-500 hover:text-red-600">
                Deactivate License
              </Button>
            </>
          ) : (
            <>
              <div className={`p-4 rounded-lg ${isExpired ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                <p className={`text-sm ${isExpired ? 'text-red-500' : 'text-amber-500'}`}>
                  {isExpired ? 'Your license has expired. Please renew to continue using the app.' : 'No active license. Enter your license key to activate.'}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="license-key">License Key</Label>
                  <Input
                    id="license-key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                    placeholder="FLOWSTRAL-XXXXX-XXXXX-XXXXX-XXXXX"
                    className="font-mono"
                  />
                </div>
                <Button 
                  onClick={handleActivate} 
                  disabled={isActivating || !newKey.trim()}
                  className="w-full"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    'Activate License'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* License Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Licensing</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Trial licenses are valid for <strong>14 days</strong> from activation</p>
          <p>• Each license can be activated on up to <strong>2 devices</strong></p>
          <p>• Deactivate on one device to free up a slot for another</p>
          <p>• Contact <a href="mailto:support@flowstral.com" className="text-primary hover:underline">support@flowstral.com</a> for renewals</p>
        </CardContent>
      </Card>
    </div>
  );
}

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
        `${API_BASE_URL}/ai/templates?project_id=default&task=${selectedTask}`
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
      const response = await fetch(`${API_BASE_URL}/ai/templates`, {
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
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
          <TabsTrigger value="license" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">License</span>
          </TabsTrigger>
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

        {/* LICENSE TAB - Show license status and days remaining */}
        <TabsContent value="license" className="space-y-6 max-w-2xl">
          <LicenseSettings />
        </TabsContent>

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
                  <Label>Clear Local Cache</Label>
                  <p className="text-sm text-muted-foreground">
                    Clear locally cached data. All test cases, runs, plans, suites, and defects are stored in the database and shared across all users.
                  </p>
                </div>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Clear all locally cached data?\n\nThis clears the browser cache only.\nYour test data is safe in the database and visible to all team members.')) {
                      // Clear test-data related localStorage keys (not theme/preferences)
                      const testDataKeys = [
                        'test_cases', 'flowstral_test_cases', 'test_plans', 'test_runs',
                        'test_execution_history', 'test_suites', 'test_defects', 'defects',
                        'test_folders', 'test_repository_folders', 'test_releases', 'releases',
                        'test_schedules', 'test_environments', 'reusable_modules',
                        'deleted_test_ids', 'execution_queue', 'qaai_test_results',
                        'workflow_test_history', 'unified_test_history',
                        'tm_test_cases', 'tm_test_suites', 'tm_schedules', 'tm_environments',
                        'tm_cache_timestamps', 'api_saved_requests', 'api_saved_chains',
                        'requirements', 'use_scale_db',
                      ];
                      testDataKeys.forEach(key => localStorage.removeItem(key));
                      // Clear unified_test_case_{id} entries
                      Object.keys(localStorage).filter(k => k.startsWith('unified_test_case_')).forEach(k => localStorage.removeItem(k));
                      Object.keys(localStorage).filter(k => k.startsWith('run_results_')).forEach(k => localStorage.removeItem(k));
                      toast.success('Local cache cleared. Database data is unaffected.');
                      setTimeout(() => window.location.reload(), 500);
                    }
                  }}
                >
                  Clear Cache
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
                  <p className="text-sm text-muted-foreground">Latest • ~79 MB</p>
                </div>
                <Button 
                  onClick={() => window.open('https://qaone-production.up.railway.app/api/download/Flowstral-Setup.exe', '_blank')}
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
