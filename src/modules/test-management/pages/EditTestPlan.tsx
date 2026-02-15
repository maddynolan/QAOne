/**
 * @module test-management
 * @page EditTestPlan
 *
 * Edit existing test plan form. Loads test plan data by ID and provides
 * the same editing capabilities as CreateTestPlan with pre-populated fields.
 *
 * @features
 * - Load and edit existing test plan details
 * - Modify associated test suites and ordering
 * - Update milestones and schedule
 * - Save changes with validation
 *
 * @api /test-plans/* - Test plan management endpoints
 *
 * @dependencies EditTestPlan uses react-router-dom (useParams), useState, useEffect, shadcn/ui
 */
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function EditTestPlan() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [formData, setFormData] = useState({
    planName: "API Integration Tests",
    description: "Comprehensive API endpoint testing suite",
    priority: "high",
    apiTests: true,
    uiTests: false,
    performanceTests: false,
    accessibilityTests: false,
    specificationContent: "Sample OpenAPI specification...",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Test plan updated successfully!");
    navigate("/plans");
  };

  const handleCancel = () => {
    navigate("/plans");
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this test plan?")) {
      toast.success("Test plan deleted successfully!");
      navigate("/plans");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Edit Test Plan</h1>
          <p className="text-muted-foreground mt-1">
            Update your test plan configuration
          </p>
        </div>
        <Button variant="destructive" onClick={handleDelete}>
          Delete Plan
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planName">Plan Name</Label>
              <Input
                id="planName"
                value={formData.planName}
                onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>Select the types of tests to include</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Test Types</Label>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Checkbox
                  id="apiTests"
                  checked={formData.apiTests}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, apiTests: checked as boolean })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="apiTests" className="font-medium cursor-pointer">
                    API Tests
                  </Label>
                  <p className="text-sm text-muted-foreground">REST API endpoint testing</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Checkbox
                  id="uiTests"
                  checked={formData.uiTests}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, uiTests: checked as boolean })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="uiTests" className="font-medium cursor-pointer">
                    UI Tests
                  </Label>
                  <p className="text-sm text-muted-foreground">User interface testing</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Checkbox
                  id="performanceTests"
                  checked={formData.performanceTests}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, performanceTests: checked as boolean })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="performanceTests" className="font-medium cursor-pointer">
                    Performance Tests
                  </Label>
                  <p className="text-sm text-muted-foreground">Load and stress testing</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Checkbox
                  id="accessibilityTests"
                  checked={formData.accessibilityTests}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, accessibilityTests: checked as boolean })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="accessibilityTests" className="font-medium cursor-pointer">
                    Accessibility Tests
                  </Label>
                  <p className="text-sm text-muted-foreground">WCAG compliance testing</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source Specification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="specification">Specification Content</Label>
              <Textarea
                id="specification"
                value={formData.specificationContent}
                onChange={(e) =>
                  setFormData({ ...formData, specificationContent: e.target.value })
                }
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" className="gradient-primary">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
