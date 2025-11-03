import { AlertCircle, Bug, Info, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { customLLMService } from "@/lib/custom-llm-service";

const issues = [
  {
    id: 1,
    severity: "high",
    test: "Login Flow - Invalid Credentials",
    error: "AssertionError: Expected status 401, got 500",
    occurrences: 15,
    firstSeen: "2024-01-14",
    aiAnalysis: null,
  },
  {
    id: 2,
    severity: "medium",
    test: "User Profile - Update Avatar",
    error: "TimeoutError: Element not found within 5000ms",
    occurrences: 8,
    firstSeen: "2024-01-13",
    aiAnalysis: null,
  },
  {
    id: 3,
    severity: "low",
    test: "Dashboard - Load Metrics",
    error: "Warning: Deprecated API endpoint",
    occurrences: 3,
    firstSeen: "2024-01-15",
    aiAnalysis: null,
  },
];

export default function Triage() {
  const [issuesState, setIssuesState] = useState(issues);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);

  const analyzeWithAI = async (issueId: number) => {
    const issue = issuesState.find(i => i.id === issueId);
    if (!issue) return;

    setAnalyzingId(issueId);
    try {
      console.log("Starting AI defect analysis...");
      
      const request = {
        org_id: "550e8400-e29b-41d4-a716-446655440000", // Mock org ID
        project_id: "550e8400-e29b-41d4-a716-446655440001", // Mock project ID
        run_id: "550e8400-e29b-41d4-a716-446655440002", // Mock run ID
        logs: issue.error,
        artifacts: [
          {
            type: "screenshot",
            url: "https://example.com/screenshot.png"
          }
        ]
      };

      console.log("AI analysis request:", request);
      
      // Use the new Ollama triage endpoint
      const response = await fetch("http://localhost:8001/ai/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const analysis = await response.json();
      console.log("AI analysis response:", analysis);
      
      // Update the issue with AI analysis
      setIssuesState(prev => prev.map(i => 
        i.id === issueId 
          ? { ...i, aiAnalysis: analysis }
          : i
      ));

      toast.success("AI analysis completed!");
    } catch (error) {
      console.error("Error analyzing defect:", error);
      toast.error(`Failed to analyze defect with AI: ${error.message}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">AI-Powered Triage</h1>
        <p className="text-muted-foreground mt-1">Review and prioritize test failures with AI insights</p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Issues</TabsTrigger>
          <TabsTrigger value="high">High Priority</TabsTrigger>
          <TabsTrigger value="medium">Medium</TabsTrigger>
          <TabsTrigger value="low">Low</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {issuesState.map((issue) => (
            <Card key={issue.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant={
                          issue.severity === "high" ? "destructive" : 
                          issue.severity === "medium" ? "default" : 
                          "secondary"
                        }
                      >
                        {issue.severity === "high" && <AlertCircle className="h-3 w-3 mr-1" />}
                        {issue.severity === "medium" && <Bug className="h-3 w-3 mr-1" />}
                        {issue.severity === "low" && <Info className="h-3 w-3 mr-1" />}
                        {issue.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {issue.occurrences} occurrences
                      </span>
                      {issue.aiAnalysis && (
                        <Badge variant="outline" className="text-green-600">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI Analyzed
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{issue.test}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      First seen: {issue.firstSeen}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <code className="text-sm text-destructive">{issue.error}</code>
                </div>
                
                {issue.aiAnalysis && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Analysis
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Summary:</span>
                        <p className="text-muted-foreground">{issue.aiAnalysis.summary}</p>
                      </div>
                      <div>
                        <span className="font-medium">Root Cause:</span>
                        <p className="text-muted-foreground">{issue.aiAnalysis.root_cause}</p>
                      </div>
                    </div>
                    {issue.aiAnalysis.suggested_fixes && (
                      <div>
                        <span className="font-medium">Suggested Fixes:</span>
                        <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                          {issue.aiAnalysis.suggested_fixes.map((fix, index) => (
                            <li key={index}>{fix}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Category: {issue.aiAnalysis.category || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Flaky Likelihood: {issue.aiAnalysis.likelihood_flaky ? `${Math.round(issue.aiAnalysis.likelihood_flaky * 100)}%` : "N/A"}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => analyzeWithAI(issue.id)}
                    disabled={analyzingId === issue.id}
                  >
                    {analyzingId === issue.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Analyze with AI
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm">Investigate</Button>
                  <Button variant="outline" size="sm">Mark as Known</Button>
                  <Button variant="outline" size="sm">Create Ticket</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="high">
          {issues.filter(i => i.severity === "high").map((issue) => (
            <Card key={issue.id}>
              <CardHeader>
                <CardTitle>{issue.test}</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-sm">{issue.error}</code>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
