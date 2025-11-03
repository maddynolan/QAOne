import { Plus, Search, Filter, Edit, Play, History, Trash2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dataStorageService, TestCase } from "@/lib/data-storage";

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

  useEffect(() => {
    loadTestCases();
  }, []);

  const loadTestCases = async () => {
    try {
      setLoading(true);
      await dataStorageService.initializeSampleData(); // Initialize sample data if needed
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
                toast.loading("Generating test cases with AI...");
                const response = await fetch("http://localhost:8001/ai/jira-to-testcases", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ jira: jiraStory, mode: "ui" })
                });
                
                const data = await response.json();
                if (data.status === "success") {
                  toast.dismiss();
                  toast.success(`Generated ${data.test_cases.length} test cases!`);
                  // Navigate to create page with pre-filled data
                  navigate("/cases/create", { 
                    state: { generatedTestCases: data.test_cases } 
                  });
                } else {
                  toast.error("Failed to generate test cases");
                }
              } catch (error) {
                toast.error(`Error: ${error.message}`);
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
                    onClick={() => navigate("/runs")}
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