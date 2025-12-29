import { AlertCircle, Bug, Info, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface Defect {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  defect_type?: string;
  page_url?: string;
  created_at: string;
  occurrences?: number;
  aiAnalysis?: {
    summary: string;
    root_cause: string;
    suggested_fixes: string[];
    category: string;
    likelihood_flaky: number;
  };
}

export default function Triage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const fetchDefects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/defects`);
      
      if (response.ok) {
        const data = await response.json();
        // Map backend defects to our format
        const mappedDefects = (data.defects || data || []).map((d: any) => ({
          id: d.id || d.defect_id,
          title: d.title || d.name || "Untitled Defect",
          description: d.description || "",
          severity: d.severity || "medium",
          status: d.status || "open",
          defect_type: d.defect_type || d.type || "functional",
          page_url: d.page_url || d.url,
          created_at: d.created_at || d.detected_at || new Date().toISOString(),
          occurrences: d.occurrences || 1,
          aiAnalysis: d.ai_analysis || null
        }));
        setDefects(mappedDefects);
      } else {
        console.error("Failed to fetch defects");
        toast.error("Failed to load defects");
      }
    } catch (error) {
      console.error("Error fetching defects:", error);
      // Load mock data for demo
      setDefects([
        {
          id: "1",
          title: "Login Flow - Invalid Credentials",
          description: "AssertionError: Expected status 401, got 500",
          severity: "high",
          status: "open",
          defect_type: "functional",
          created_at: new Date().toISOString(),
          occurrences: 15
        },
        {
          id: "2",
          title: "User Profile - Update Avatar",
          description: "TimeoutError: Element not found within 5000ms",
          severity: "medium",
          status: "open",
          defect_type: "ui",
          created_at: new Date().toISOString(),
          occurrences: 8
        },
        {
          id: "3",
          title: "Dashboard - Load Metrics",
          description: "Warning: Deprecated API endpoint",
          severity: "low",
          status: "open",
          defect_type: "api",
          created_at: new Date().toISOString(),
          occurrences: 3
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefects();
  }, []);

  const analyzeWithAI = async (defectId: string) => {
    const defect = defects.find(d => d.id === defectId);
    if (!defect) return;

    setAnalyzingId(defectId);
    try {
      const request = {
        org_id: "550e8400-e29b-41d4-a716-446655440000",
        project_id: "550e8400-e29b-41d4-a716-446655440001",
        run_id: "550e8400-e29b-41d4-a716-446655440002",
        logs: `${defect.title}: ${defect.description}`,
        artifacts: []
      };

      const response = await fetch(`${API_BASE_URL}/ai/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const analysis = await response.json();
      
      // Update the defect with AI analysis
      setDefects(prev => prev.map(d => 
        d.id === defectId 
          ? { ...d, aiAnalysis: analysis }
          : d
      ));

      toast.success("AI analysis completed!");
    } catch (error: any) {
      console.error("Error analyzing defect:", error);
      toast.error(`Failed to analyze defect with AI: ${error.message}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return <AlertCircle className="h-3 w-3 mr-1" />;
      case "medium":
        return <Bug className="h-3 w-3 mr-1" />;
      default:
        return <Info className="h-3 w-3 mr-1" />;
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return "destructive" as const;
      case "medium":
        return "default" as const;
      default:
        return "secondary" as const;
    }
  };

  const filterBySeverity = (severity: string | null) => {
    if (!severity) return defects;
    return defects.filter(d => d.severity === severity);
  };

  const renderDefectCard = (defect: Defect) => (
    <Card key={defect.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={getSeverityVariant(defect.severity)}>
                {getSeverityIcon(defect.severity)}
                {defect.severity}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {defect.occurrences || 1} occurrence{(defect.occurrences || 1) > 1 ? 's' : ''}
              </span>
              {defect.aiAnalysis && (
                <Badge variant="outline" className="text-green-600">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Analyzed
                </Badge>
              )}
              {defect.defect_type && (
                <Badge variant="outline">{defect.defect_type}</Badge>
              )}
            </div>
            <CardTitle className="text-lg">{defect.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              First seen: {new Date(defect.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted p-3 rounded-lg">
          <code className="text-sm text-destructive break-all">{defect.description}</code>
        </div>
        
        {defect.page_url && (
          <p className="text-xs text-muted-foreground">
            URL: <a href={defect.page_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{defect.page_url}</a>
          </p>
        )}
        
        {defect.aiAnalysis && (
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-3">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Summary:</span>
                <p className="text-muted-foreground">{defect.aiAnalysis.summary}</p>
              </div>
              <div>
                <span className="font-medium">Root Cause:</span>
                <p className="text-muted-foreground">{defect.aiAnalysis.root_cause}</p>
              </div>
            </div>
            {defect.aiAnalysis.suggested_fixes && defect.aiAnalysis.suggested_fixes.length > 0 && (
              <div>
                <span className="font-medium">Suggested Fixes:</span>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                  {defect.aiAnalysis.suggested_fixes.map((fix, index) => (
                    <li key={index}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {defect.aiAnalysis.category && (
                <span>Category: {defect.aiAnalysis.category}</span>
              )}
              {defect.aiAnalysis.likelihood_flaky !== undefined && (
                <span>Flaky Likelihood: {Math.round(defect.aiAnalysis.likelihood_flaky * 100)}%</span>
              )}
            </div>
          </div>
        )}
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => analyzeWithAI(defect.id)}
            disabled={analyzingId === defect.id}
          >
            {analyzingId === defect.id ? (
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
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">AI-Powered Triage</h1>
          <p className="text-muted-foreground mt-1">Review and prioritize test failures with AI insights</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDefects}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {defects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bug className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Defects Found</h3>
            <p className="text-muted-foreground">
              Great news! There are no defects to triage at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Issues ({defects.length})</TabsTrigger>
            <TabsTrigger value="critical">Critical ({filterBySeverity("critical").length})</TabsTrigger>
            <TabsTrigger value="high">High ({filterBySeverity("high").length})</TabsTrigger>
            <TabsTrigger value="medium">Medium ({filterBySeverity("medium").length})</TabsTrigger>
            <TabsTrigger value="low">Low ({filterBySeverity("low").length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {defects.map(renderDefectCard)}
          </TabsContent>

          {["critical", "high", "medium", "low"].map(severity => (
            <TabsContent key={severity} value={severity} className="space-y-4">
              {filterBySeverity(severity).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No {severity} priority issues found
                  </CardContent>
                </Card>
              ) : (
                filterBySeverity(severity).map(renderDefectCard)
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
