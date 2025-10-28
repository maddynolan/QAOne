import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your QA AI Platform configuration</p>
      </div>

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
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button className="gradient-primary">Save Changes</Button>
      </div>
    </div>
  );
}
