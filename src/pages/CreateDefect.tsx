import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { dataStorageService } from "@/lib/data-storage";
import { useEffect, useState } from "react";

export default function CreateDefect() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(isEditMode);

  const [formValues, setFormValues] = useState({
    title: '',
    description: '',
    severity: 'medium',
    priority: 'medium'
  });

  useEffect(() => {
    if (isEditMode && id) {
      setLoading(true);
      // Load defect data for editing
      dataStorageService.getDefect(id).then(defect => {
        if (defect) {
          setFormValues({
            title: defect.title || '',
            description: defect.description || '',
            severity: defect.severity || 'medium',
            priority: defect.priority || 'medium'
          });
          setLoading(false);
        } else {
          toast.error("Defect not found");
          navigate("/defects");
        }
      }).catch((error) => {
        console.error("Error loading defect:", error);
        toast.error("Failed to load defect");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [id, isEditMode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;
    
    try {
      const defectData = {
        title: formValues.title,
        description: formValues.description,
        severity: formValues.severity as any,
        priority: formValues.priority as any,
        status: 'open' as const
      };

      if (isEditMode && id) {
        await dataStorageService.updateDefect(id, defectData);
        toast.success("Defect updated successfully!");
      } else {
        await dataStorageService.createDefect(defectData);
        toast.success("Defect reported successfully!");
      }
      navigate("/defects");
    } catch (error: any) {
      console.error("Error saving defect:", error);
      toast.error(`Failed to save defect: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    navigate("/defects");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/defects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold gradient-text">{isEditMode ? "Edit Defect" : "Report Defect"}</h1>
          <p className="text-muted-foreground mt-1">{isEditMode ? "Update defect details" : "Create a new bug or issue report"}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Provide core details of the defect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Defect Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g., Login button not responding on Chrome"
                value={formValues.title}
                onChange={(e) => setFormValues({...formValues, title: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Provide a detailed description of the issue..."
                value={formValues.description}
                onChange={(e) => setFormValues({...formValues, description: e.target.value})}
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testCase">Related Test Case</Label>
                <Select>
                  <SelectTrigger id="testCase">
                    <SelectValue placeholder="Select test case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="login">User Login Flow</SelectItem>
                    <SelectItem value="api">API Authentication</SelectItem>
                    <SelectItem value="payment">Payment Processing</SelectItem>
                    <SelectItem value="registration">User Registration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testRun">Test Run</Label>
                <Select>
                  <SelectTrigger id="testRun">
                    <SelectValue placeholder="Select test run" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="run1">Regression Suite - Jan 15</SelectItem>
                    <SelectItem value="run2">API Tests - Jan 14</SelectItem>
                    <SelectItem value="run3">Smoke Tests - Jan 13</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select 
                  name="severity"
                  value={formValues.severity}
                  onValueChange={(value) => setFormValues({...formValues, severity: value})}
                  required
                >
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  name="priority"
                  value={formValues.priority}
                  onValueChange={(value) => setFormValues({...formValues, priority: value})}
                  required
                >
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

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select required>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="retest">Retest</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="reopened">Reopened</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reproduction Details</CardTitle>
            <CardDescription>How to reproduce this defect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stepsToReproduce">Steps to Reproduce</Label>
              <Textarea
                id="stepsToReproduce"
                placeholder="1. Navigate to login page&#10;2. Enter invalid credentials&#10;3. Click login button&#10;4. Observe the error"
                rows={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualResult">Actual Result</Label>
              <Textarea
                id="actualResult"
                placeholder="What actually happened..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedResult">Expected Result</Label>
              <Textarea
                id="expectedResult"
                placeholder="What should have happened..."
                rows={3}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Details</CardTitle>
            <CardDescription>Where was this defect found</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select required>
                  <SelectTrigger id="environment">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="qa">QA</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="browser">Browser</Label>
                <Select>
                  <SelectTrigger id="browser">
                    <SelectValue placeholder="Select browser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chrome">Chrome</SelectItem>
                    <SelectItem value="firefox">Firefox</SelectItem>
                    <SelectItem value="safari">Safari</SelectItem>
                    <SelectItem value="edge">Edge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="os">Operating System</Label>
                <Select>
                  <SelectTrigger id="os">
                    <SelectValue placeholder="Select OS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="windows">Windows</SelectItem>
                    <SelectItem value="macos">macOS</SelectItem>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="ios">iOS</SelectItem>
                    <SelectItem value="android">Android</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version/Build</Label>
                <Input
                  id="version"
                  placeholder="e.g., v2.1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment & Tracking</CardTitle>
            <CardDescription>Assign and track the defect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Select>
                  <SelectTrigger id="assignedTo">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="john">John Doe</SelectItem>
                    <SelectItem value="jane">Jane Smith</SelectItem>
                    <SelectItem value="bob">Bob Johnson</SelectItem>
                    <SelectItem value="alice">Alice Brown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sprint">Sprint/Release</Label>
                <Input
                  id="sprint"
                  placeholder="e.g., Sprint 24, Release 2.1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                placeholder="e.g., ui, login, critical"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional context, workarounds, or related information..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" className="gradient-primary">
            Report Defect
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
