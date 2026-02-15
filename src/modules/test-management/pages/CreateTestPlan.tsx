/**
 * @module test-management
 * @page CreateTestPlan
 *
 * Create new test plan form. Allows defining test plan metadata, objectives,
 * scope, and associating test suites with the plan.
 *
 * @features
 * - Test plan name, description, and objective fields
 * - Test suite selection and ordering
 * - Milestone and schedule configuration
 * - Environment and resource allocation
 *
 * @api /test-plans/* - Test plan management endpoints
 *
 * @dependencies CreateTestPlan uses react-router-dom, useState, shadcn/ui form components
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { dataStorageService } from "@/lib/data-storage";

export default function CreateTestPlan() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    planName: "",
    description: "",
    priority: "low",
    apiTests: false,
    uiTests: false,
    performanceTests: false,
    accessibilityTests: false,
    specificationContent: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await dataStorageService.createTestPlan({
        name: formData.planName,
        description: formData.description,
        testCases: [],
        estimatedDuration: 0,
        coverage: "",
        riskAssessment: ""
      });
      
      toast.success("Test plan created successfully!");
      navigate("/plans");
    } catch (error: any) {
      console.error("Error creating test plan:", error);
      toast.error(error.message || "Failed to create test plan. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/plans");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Create Test Plan</h1>
        <p className="text-muted-foreground mt-1">
          Generate a comprehensive test plan from your API specification or requirements.
        </p>
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
                placeholder="e.g., E-commerce API Tests"
                value={formData.planName}
                onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the test plan..."
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
            <CardDescription>Select the types of tests to include in your plan</CardDescription>
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
                placeholder="Paste your OpenAPI/Swagger JSON, YAML, user stories, or plain text requirements here..."
                value={formData.specificationContent}
                onChange={(e) =>
                  setFormData({ ...formData, specificationContent: e.target.value })
                }
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: OpenAPI/Swagger JSON, YAML, user stories, or plain text requirements.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="gradient-primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Test Plan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
