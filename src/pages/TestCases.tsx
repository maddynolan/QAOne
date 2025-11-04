import { Plus, Search, Filter, Edit, Play, History, Trash2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dataStorageService, TestCase } from "@/lib/data-storage";
import { QualityRating } from "@/components/QualityRating";
import { EditAndImprove } from "@/components/EditAndImprove";

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical": return "destructive";
    case "high": return "default";
    case "medium": return "secondary";
    default: return "outline";
  }
};

export default function TestCases() {
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastGenerationId, setLastGenerationId] = useState<string | null>(null);
  const [lastGenerationOutput, setLastGenerationOutput] = useState<string>("");

  useEffect(() => {
    loadTestCases();
  }, []);

  // Reload when component becomes visible (e.g., after navigation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadTestCases();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadTestCases = async () => {
    try {
      setLoading(true);
      // Load test cases directly - initialization happens once on app start
      const cases = await dataStorageService.getTestCases();
      setTestCases(cases);
    } catch (error) {
      console.error("Error loading test cases:", error);
      toast.error("Failed to load test cases");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTestCase = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this test case?")) {
      try {
        await dataStorageService.deleteTestCase(id);
        setTestCases(prev => prev.filter(tc => tc.id !== id));
        toast.success("Test case deleted successfully");
      } catch (error) {
        console.error("Error deleting test case:", error);
        toast.error("Failed to delete test case");
      }
    }
  };

  const executeSingleTestRun = async (runId: string, testCase: TestCase) => {
    try {
      // Use default IDs that match backend constants
      const orgId = "00000000-0000-0000-0000-000000000000"; // DEFAULT_ORG_ID
      const projectId = "11111111-1111-1111-1111-111111111111"; // DEFAULT_PROJECT_ID
      
      // Show loading toast (this will be dismissed on success/error)
      const loadingToastId = toast.loading("Executing test...");
      
      const response = await fetch("http://localhost:8000/tests/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          project_id: projectId,
          test_cases: [{
            id: testCase.id,
            title: testCase.name,
            description: testCase.description,
            priority: testCase.priority,
            tags: testCase.tags,
            steps: testCase.steps.map(step => ({
              action: step.action,
              data: {},
              expected: step.expectedResult,
              locator_hints: []
            }))
          }]
        })
      });
      
      toast.dismiss(loadingToastId);
      
      if (!response.ok) {
        let errorMessage = "Test execution failed";
        try {
          const errorText = await response.text();
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorText || errorMessage;
        } catch {
          errorMessage = await response.text() || errorMessage;
        }
        
        // Update test run status to failed
        try {
          await fetch(`http://localhost:8000/test-runs/${runId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "failed",
              completed_at: new Date().toISOString()
            })
          });
        } catch (updateError) {
          console.error("Failed to update run status:", updateError);
        }
        
        toast.error(errorMessage);
        return; // Don't throw - we've handled it
      }
      
      const result = await response.json();
      
      // Update test run status in backend
      await fetch(`http://localhost:8001/test-runs/${runId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: result.summary?.failed === 0 ? "completed" : "failed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
      });
      
      toast.success(`Test execution completed! ${result.summary?.passed || 0} passed, ${result.summary?.failed || 0} failed`);
      
    } catch (error: any) {
      console.error("Error executing test:", error);
      // Only show error if it's not already shown
      toast.error(`Test execution error: ${error.message || "Unknown error"}`);
      
      // Update test run status to failed
      try {
        await fetch(`http://localhost:8001/test-runs/${runId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "failed",
            completed_at: new Date().toISOString()
          })
        });
      } catch (updateError) {
        console.error("Failed to update run status:", updateError);
      }
    }
  };

  const filteredTestCases = testCases.filter(testCase =>
    testCase.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    testCase.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    testCase.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Test Cases</h1>
            <p className="text-muted-foreground mt-1">Loading test cases...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Cases</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage individual test cases ({testCases.length} total)
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              // Open a dialog to input Jira story
              const jiraStory = prompt("Enter Jira story or requirements:");
              if (!jiraStory) return;
              
              try {
                const loadingToast = toast.loading("Generating test cases with AI... This may take 60-90 seconds.");
                const response = await fetch("http://localhost:8000/ai/jira-to-testcases", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    jira: jiraStory, 
                    mode: "ui",
                    project_id: "11111111-1111-1111-1111-111111111111",
                    org_id: "00000000-0000-0000-0000-000000000000"
                  }),
                  signal: AbortSignal.timeout(180000) // 3 minutes timeout
                });
                
                toast.dismiss(loadingToast);
                
                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                  throw new Error(errorData.detail || `Server error: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.status === "success" && data.test_cases && data.test_cases.length > 0) {
                  const latencySeconds = data.latency_ms ? Math.round(data.latency_ms / 1000) : 0;
                  const cacheInfo = data.cache_hit ? ` (cached from ${data.cache_level})` : '';
                  toast.success(
                    `Generated ${data.test_cases.length} test cases in ${latencySeconds}s${cacheInfo}!`,
                    {
                      duration: 5000,
                      action: data.generation_id ? {
                        label: "Rate Quality",
                        onClick: () => {
                          setLastGenerationId(data.generation_id);
                          setLastGenerationOutput(JSON.stringify(data.test_cases, null, 2));
                        }
                      } : undefined
                    }
                  );
                  
                  // Store generation ID for rating
                  if (data.generation_id) {
                    setLastGenerationId(data.generation_id);
                    setLastGenerationOutput(JSON.stringify(data.test_cases, null, 2));
                  }
                  
                  // Navigate to create page with pre-filled data
                  navigate("/cases/create", { 
                    state: { generatedTestCases: data.test_cases } 
                  });
                } else {
                  toast.error("Failed to generate test cases - no test cases returned");
                }
              } catch (error: any) {
                if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                  toast.error("Request timed out. The model is taking too long. Try a shorter requirement or use 'quick' mode.");
                } else {
                  toast.error(`Error: ${error.message || 'Failed to generate test cases'}`);
                }
                console.error("AI generation error:", error);
              }
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate with AI
          </Button>
          <Button className="gradient-primary" onClick={() => navigate("/cases/create")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Test Case
          </Button>
        </div>
      </div>

      {/* Quality Rating & Edit Tools */}
      {lastGenerationId && (
        <div className="bg-muted/50 border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Help improve AI quality</p>
            <p className="text-xs text-muted-foreground">
              Rate the generation or submit corrections to help train a better model
            </p>
          </div>
          <div className="flex gap-2">
            <QualityRating 
              generationId={lastGenerationId}
              onRated={() => {
                setLastGenerationId(null);
                setLastGenerationOutput("");
              }}
            />
            <EditAndImprove
              generationId={lastGenerationId}
              originalOutput={lastGenerationOutput}
              onCorrected={() => {
                setLastGenerationId(null);
                setLastGenerationOutput("");
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLastGenerationId(null);
                setLastGenerationOutput("");
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search test cases..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {filteredTestCases.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-4">
              <div className="text-6xl">📝</div>
              <h3 className="text-xl font-semibold">No test cases found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "No test cases match your search criteria." : "Create your first test case to get started."}
              </p>
              {!searchTerm && (
                <Button className="gradient-primary" onClick={() => navigate("/cases/create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Test Case
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTestCases.map((testCase) => (
            <Card key={testCase.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{testCase.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {testCase.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Type: {testCase.testType}</span>
                      <span>Complexity: {testCase.complexity}</span>
                      <span>Est. Time: {testCase.estimatedTime}min</span>
                      <span>Steps: {testCase.steps.length}</span>
                    </div>
                    {testCase.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {testCase.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getPriorityColor(testCase.priority)}>
                      {testCase.priority}
                    </Badge>
                    <Badge variant="default">
                      {testCase.testType}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/cases/edit/${testCase.id}`)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        // Create a test run with this single test case
                        const testRun = await dataStorageService.createTestRun({
                          name: `Test Run: ${testCase.name}`,
                          status: 'pending',
                          testCases: [{
                            id: testCase.id,
                            title: testCase.name,
                            description: testCase.description,
                            priority: testCase.priority,
                            tags: testCase.tags,
                            steps: testCase.steps.map(step => ({
                              action: step.action,
                              data: {},
                              expected: step.expectedResult,
                              locator_hints: []
                            }))
                          }],
                          results: []
                        });
                        
                        toast.success("Test run created!");
                        navigate(`/runs/${testRun.id}`);
                      } catch (error: any) {
                        console.error("Error creating test run:", error);
                        toast.error(`Failed to create test run: ${error.message}`);
                      }
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run Test
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate("/runs")}
                  >
                    <History className="h-3 w-3 mr-1" />
                    History
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteTestCase(testCase.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}