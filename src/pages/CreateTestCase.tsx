import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export default function CreateTestCase() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Test case created successfully!");
    navigate("/cases");
  };

  const handleCancel = () => {
    navigate("/cases");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cases")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold gradient-text">Create Test Case</h1>
          <p className="text-muted-foreground mt-1">Define a new test case</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Define the core details of your test case</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Test Case Name</Label>
              <Input
                id="name"
                placeholder="e.g., User Login Flow"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this test case validates..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan">Associated Test Plan</Label>
                <Select>
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Select a test plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regression">Regression Test Suite</SelectItem>
                    <SelectItem value="api">API Integration Tests</SelectItem>
                    <SelectItem value="e2e">E2E User Flows</SelectItem>
                    <SelectItem value="performance">Performance Tests</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Steps</CardTitle>
            <CardDescription>Define the steps to execute this test case</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preconditions">Preconditions</Label>
              <Textarea
                id="preconditions"
                placeholder="What needs to be set up before running this test..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="steps">Test Steps</Label>
              <Textarea
                id="steps"
                placeholder="1. Navigate to login page&#10;2. Enter valid credentials&#10;3. Click login button&#10;4. Verify successful login"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected">Expected Result</Label>
              <Textarea
                id="expected"
                placeholder="What should happen when the test passes..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Type</CardTitle>
            <CardDescription>Select the type of test case</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup defaultValue="manual">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual">Manual Test</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="automated" id="automated" />
                <Label htmlFor="automated">Automated Test</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="api" id="api" />
                <Label htmlFor="api">API Test</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" className="gradient-primary">
            Create Test Case
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
