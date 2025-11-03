import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Sparkles, Loader2, Code, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { customLLMService } from "@/lib/custom-llm-service";
import { dataStorageService } from "@/lib/data-storage";
import { testExecutionService } from "@/lib/test-execution-service";

interface TestStep {
  id: string;
  action: string;
  expectedResult: string;
}

export default function CreateTestCase() {
  const navigate = useNavigate();
  const [testSteps, setTestSteps] = useState<TestStep[]>([
    { id: "1", action: "", expectedResult: "" }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCodeReview, setShowCodeReview] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [manualSteps, setManualSteps] = useState<any[]>([]);
  const [suggestedWebsites, setSuggestedWebsites] = useState<any[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    requirements: "",
    testType: "",
    complexity: "",
    context: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const testCaseData = {
        name: formData.name,
        description: formData.description,
        steps: testSteps.map(step => ({
          action: step.action,
          expectedResult: step.expectedResult
        })),
        preconditions: [], // You can add preconditions input later
        testData: [], // You can add test data input later
        priority: "medium" as const, // You can add priority input later
        tags: [], // You can add tags input later
        testType: formData.testType || "manual",
        complexity: formData.complexity || "medium",
        estimatedTime: 15 // You can calculate this based on steps
      };

      await dataStorageService.createTestCase(testCaseData);
      toast.success("Test case created and saved successfully!");
      navigate("/cases");
    } catch (error) {
      console.error("Error saving test case:", error);
      toast.error("Failed to save test case. Please try again.");
    }
  };

  const handleCancel = () => {
    navigate("/cases");
  };

  const runGeneratedTest = async () => {
    if (!generatedCode) {
      toast.error("No generated code to run");
      return;
    }

    setIsRunningTest(true);
    setTestResults(null);
    
    try {
      console.log("Running generated test...");
      const result = await testExecutionService.runGeneratedTest(generatedCode, formData.name || "generated_test");
      
      console.log("Test execution result:", result);
      setTestResults(result);
      
      if (result.status === "success") {
        const passedTests = result.test_results.filter((r: any) => r.status === "passed").length;
        const totalTests = result.test_results.length;
        toast.success(`Test execution completed! ${passedTests}/${totalTests} tests passed`);
        
        // Log debug info if available
        if (result.debug_info) {
          console.log("Test execution debug info:", result.debug_info);
        }
      } else {
        toast.error(`Test execution failed: ${result.error}`);
        console.error("Test execution error:", result);
      }
    } catch (error) {
      console.error("Error running test:", error);
      toast.error(`Failed to run test: ${error.message}`);
    } finally {
      setIsRunningTest(false);
    }
  };

  const addTestStep = () => {
    setTestSteps([...testSteps, { id: Date.now().toString(), action: "", expectedResult: "" }]);
  };

  const removeTestStep = (id: string) => {
    if (testSteps.length > 1) {
      setTestSteps(testSteps.filter(step => step.id !== id));
    }
  };

  const updateTestStep = (id: string, field: 'action' | 'expectedResult', value: string) => {
    setTestSteps(testSteps.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  const generateWithAI = async () => {
    if (!formData.description.trim()) {
      toast.error("Please provide a description before generating with AI");
      return;
    }

    setIsGenerating(true);
    try {
      console.log("Starting AI generation...");
      
      const request = {
        feature: formData.name || "Test Feature",
        description: formData.description,
        requirements: formData.requirements,
        testType: formData.testType || "manual",
        complexity: formData.complexity || "medium",
        context: formData.context
      };

      console.log("AI request:", request);
      console.log("Selected test type:", formData.testType);
      console.log("Form data:", formData);
      const response = await customLLMService.generateTestCase(request);
      console.log("AI response:", response);
      console.log("Generated code:", response.generatedCode);
      console.log("Manual steps:", response.manualSteps);
      console.log("Response keys:", Object.keys(response));
      
      // Update form with AI-generated content
      setFormData(prev => ({
        ...prev,
        name: response.testCase.name,
        description: response.testCase.description
      }));

      // Update test steps
      const generatedSteps = response.testCase.steps.map((step, index) => ({
        id: (index + 1).toString(),
        action: step.action,
        expectedResult: step.expectedResult
      }));
      setTestSteps(generatedSteps);

      // Handle generated code or manual steps for review
      console.log("Checking response for code generation:");
      console.log("response.generatedCode:", response.generatedCode);
      console.log("response.manualSteps:", response.manualSteps);
      console.log("response.suggestedWebsites:", response.suggestedWebsites);
      
      if (response.generatedCode) {
        console.log("Setting generated code and showing review dialog");
        setGeneratedCode(response.generatedCode);
        setShowCodeReview(true);
        setSuggestedWebsites(response.suggestedWebsites || []);
      } else if (response.manualSteps) {
        console.log("Setting manual steps and showing review dialog");
        setManualSteps(response.manualSteps);
        setShowCodeReview(true);
        setSuggestedWebsites(response.suggestedWebsites || []);
      } else {
        console.log("No code or manual steps found, showing success toast");
        toast.success("Test case generated successfully with AI!");
      }
      
      // Show suggestions if any
      if (response.suggestions.length > 0) {
        toast.info(`AI Suggestions: ${response.suggestions.join(", ")}`);
      }
    } catch (error) {
      console.error("Error generating test case:", error);
      toast.error(`Failed to generate test case with AI: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
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
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <div className="space-y-2">
                <Textarea
                  id="description"
                  placeholder="Describe what this test case validates..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateWithAI}
                  disabled={isGenerating || !formData.description.trim()}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Test Case with AI
                    </>
                  )}
                </Button>
              </div>
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
                <Label htmlFor="module">Module/Component</Label>
                <Select>
                  <SelectTrigger id="module">
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auth">Authentication</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="user">User Management</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select>
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blocker">Blocker</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="trivial">Trivial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Test Type</Label>
                <Select value={formData.testType} onValueChange={(value) => setFormData(prev => ({ ...prev, testType: value }))}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="automated">Automated</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="ui">UI</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testUrl">Test Website URL (Optional)</Label>
              <Input
                id="testUrl"
                placeholder="https://www.saucedemo.com"
                value={formData.context}
                onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Enter the URL of the website you want to test. Leave empty for default suggestions.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                placeholder="e.g., smoke, regression, critical-path"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Execution Details</CardTitle>
            <CardDescription>Define preconditions and test data</CardDescription>
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
              <Label htmlFor="testData">Test Data</Label>
              <Textarea
                id="testData"
                placeholder="Required test data (e.g., valid user credentials, test payment cards)"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedTime">Estimated Time (minutes)</Label>
                <Input
                  id="estimatedTime"
                  type="number"
                  placeholder="e.g., 15"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="automationStatus">Automation Status</Label>
                <Select>
                  <SelectTrigger id="automationStatus">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="to-be-automated">To Be Automated</SelectItem>
                    <SelectItem value="automated">Automated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Test Steps</CardTitle>
                <CardDescription>Define the sequential steps and expected results</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTestStep}>
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {testSteps.map((step, index) => (
              <div key={step.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Step {index + 1}</Label>
                  {testSteps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTestStep(step.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`action-${step.id}`}>Action</Label>
                  <Textarea
                    id={`action-${step.id}`}
                    placeholder="Describe what action to perform..."
                    rows={2}
                    value={step.action}
                    onChange={(e) => updateTestStep(step.id, 'action', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`expected-${step.id}`}>Expected Result</Label>
                  <Textarea
                    id={`expected-${step.id}`}
                    placeholder="What should happen after this action..."
                    rows={2}
                    value={step.expectedResult}
                    onChange={(e) => updateTestStep(step.id, 'expectedResult', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>Optional metadata and attachments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requirements">Related Requirements/Stories</Label>
              <Input
                id="requirements"
                placeholder="e.g., REQ-123, USER-456"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information or context..."
                rows={3}
              />
            </div>
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

      {/* Code Review Dialog */}
      <Dialog open={showCodeReview} onOpenChange={setShowCodeReview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Review Generated Test Code
            </DialogTitle>
            <DialogDescription>
              Review the AI-generated test code below. Click "Approve" to use this code, or "Cancel" to regenerate.
            </DialogDescription>
          </DialogHeader>

          {suggestedWebsites.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Suggested Test Websites:</h4>
              <div className="space-y-2">
                {suggestedWebsites.map((site, idx) => (
                  <div key={idx} className="text-sm">
                    <strong>{site.name}:</strong> <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{site.url}</a>
                    <span className="text-muted-foreground"> ({site.features})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {generatedCode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Generated Test Code (Playwright)</Label>
                <Button
                  onClick={runGeneratedTest}
                  disabled={isRunningTest}
                  variant="outline"
                  size="sm"
                >
                  {isRunningTest ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running Test...
                    </>
                  ) : (
                    <>
                      <Code className="h-4 w-4 mr-2" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>
              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                <code>{generatedCode}</code>
              </pre>
              
              {testResults && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Test Execution Results:</h4>
                  {testResults.test_results.map((result: any, idx: number) => (
                    <div key={idx} className="mb-2 p-2 rounded border-l-4 border-l-green-500 bg-white dark:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.test_name}</span>
                        <span className={`px-2 py-1 rounded text-sm ${
                          result.status === 'passed' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {result.status}
                        </span>
                      </div>
                      {result.duration && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Duration: {result.duration}ms
                        </p>
                      )}
                      {result.error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          Error: {result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {manualSteps.length > 0 && (
            <div className="space-y-2">
              <Label>Manual Test Steps</Label>
              <div className="space-y-3">
                {manualSteps.map((step, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                          {step.step_number || idx + 1}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div>
                            <strong className="text-sm">Action:</strong>
                            <p className="text-sm mt-1">{step.action}</p>
                          </div>
                          <div>
                            <strong className="text-sm">Expected Result:</strong>
                            <p className="text-sm mt-1 text-green-600 dark:text-green-400">{step.expected_result}</p>
                          </div>
                          {step.notes && (
                            <div>
                              <strong className="text-sm text-muted-foreground">Notes:</strong>
                              <p className="text-sm mt-1 text-muted-foreground">{step.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCodeReview(false);
                setGeneratedCode("");
                setManualSteps([]);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Store generated code in formData
                if (generatedCode) {
                  setFormData(prev => ({
                    ...prev,
                    context: generatedCode
                  }));
                }
                setShowCodeReview(false);
                toast.success("Test code approved! Click 'Create Test Case' to save.");
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve & Use Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
