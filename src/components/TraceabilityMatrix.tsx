import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, GitBranch, Bug, TestTube, CheckCircle, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TraceabilityMatrixProps {
  testRun?: any;
}

export function TraceabilityMatrix({ testRun }: TraceabilityMatrixProps) {
  const navigate = useNavigate();
  const [traceability, setTraceability] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTraceability();
  }, []);

  const loadTraceability = async () => {
    try {
      const response = await fetch("http://localhost:8000/traceability");
      if (response.ok) {
        const data = await response.json();
        setTraceability(data.traceability || []);
      }
    } catch (error) {
      console.error("Error loading traceability:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading traceability...</div>;
  }

  if (traceability.length === 0) {
    return (
      <div className="text-center py-12">
        <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Traceability Data</h3>
        <p className="text-muted-foreground">
          Link requirements to test cases to see traceability matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {traceability.map((item: any) => (
        <Card key={item.requirement.id} className="overflow-hidden">
          <CardContent className="p-0">
            {/* Requirement Header */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-lg">{item.requirement.title}</h3>
                    {item.requirement.source && (
                      <Badge variant="outline">
                        {item.requirement.source}
                        {item.requirement.source_ref && `: ${item.requirement.source_ref}`}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Test Cases */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Test Cases ({item.test_cases?.length || 0})
                </h4>
                {item.test_cases && item.test_cases.length > 0 ? (
                  <div className="space-y-2 ml-6">
                    {item.test_cases.map((tc: any) => (
                      <div key={tc.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                        <div className="flex items-center gap-3 flex-1">
                          <Badge variant={
                            tc.status === "active" ? "default" : 
                            tc.status === "archived" ? "secondary" : 
                            "outline"
                          }>
                            {tc.status || "draft"}
                          </Badge>
                          <Badge variant={
                            tc.priority === "P0" ? "destructive" : 
                            tc.priority === "P1" ? "default" : 
                            "secondary"
                          }>
                            {tc.priority}
                          </Badge>
                          <span className="font-medium">{tc.title}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/cases/edit/${tc.id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground ml-6">No test cases linked</p>
                )}
              </div>

              {/* Test Runs */}
              {item.test_runs && item.test_runs.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Test Runs ({item.test_runs.length})
                  </h4>
                  <div className="space-y-2 ml-6">
                    {item.test_runs.map((tr: any) => (
                      <div key={tr.id} className="flex items-center justify-between p-2 border rounded bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            tr.status === "passed" ? "default" : 
                            tr.status === "failed" ? "destructive" : 
                            "secondary"
                          }>
                            {tr.status === "passed" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {tr.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                            {tr.status}
                          </Badge>
                          <span className="text-sm">{tr.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/runs/${tr.id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Defects */}
              {item.defects && item.defects.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Defects ({item.defects.length})
                  </h4>
                  <div className="space-y-2 ml-6">
                    {item.defects.map((defect: any) => (
                      <div key={defect.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                        <div className="flex items-center gap-3 flex-1">
                          <Badge variant={
                            defect.status === "open" ? "destructive" : 
                            defect.status === "fixed" ? "default" : 
                            "secondary"
                          }>
                            {defect.status}
                          </Badge>
                          <span className="font-medium">{defect.title}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/defects/edit/${defect.id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

