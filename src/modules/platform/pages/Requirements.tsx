/**
 * @module platform
 * @page Requirements
 *
 * Requirements management page. Lists all requirements with filtering,
 * search, and status tracking. Supports CRUD operations, AI-powered
 * test case generation from requirements, and traceability linking.
 *
 * @features
 * - Requirements listing with search and filtering
 * - Status and priority management
 * - AI-powered test case generation from requirements
 * - Traceability linking to test cases
 * - Import from external sources (Jira, Azure DevOps)
 *
 * @api /api/requirements/* - Requirements management endpoints
 *
 * @dependencies Requirements uses lucide-react, react-router-dom, useState, useEffect, sonner toast
 */
import { Plus, Search, Filter, FileText, ExternalLink, Edit, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { API_ENDPOINTS } from "@/lib/api-config";

interface Requirement {
  id: string;
  title: string;
  description: string;
  acceptance_criteria?: string;
  source: string;
  source_ref: string;
  created_at: string;
}

export default function Requirements() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string>("");

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      
      // Load from localStorage first
      const localReqs = JSON.parse(localStorage.getItem('requirements') || '[]');
      
      // Try to load from API
      let apiReqs: any[] = [];
      try {
        const response = await fetch(API_ENDPOINTS.REQUIREMENTS);
        if (response.ok) {
          const data = await response.json();
          apiReqs = data.requirements || [];
        }
      } catch (apiError) {
        console.warn('API not available, using localStorage only');
      }
      
      // Merge and deduplicate (prefer localStorage for local items)
      const allReqs = [...localReqs];
      apiReqs.forEach(apiReq => {
        if (!allReqs.some(r => r.id === apiReq.id)) {
          allReqs.push(apiReq);
        }
      });
      
      setRequirements(allReqs);
    } catch (error: any) {
      console.error("Error loading requirements:", error);
      toast.error("Failed to load requirements");
    } finally {
      setLoading(false);
    }
  };

  const getSourceColor = (source: string) => {
    if (!source) return "default";
    const sourceLower = source.toLowerCase();
    if (sourceLower.includes("api")) return "default";
    if (sourceLower.includes("eco") || sourceLower.includes("commerce")) return "secondary";
    if (sourceLower.includes("bank")) return "destructive";
    if (sourceLower.includes("todo")) return "outline";
    return "default";
  };

  const filteredRequirements = requirements.filter((req) =>
    (req.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.source_ref || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Requirements</h1>
            <p className="text-muted-foreground mt-1">Loading requirements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Requirements</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your requirements ({requirements.length} total)
          </p>
        </div>
        <Button className="gradient-primary" onClick={() => navigate("/requirements/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Requirement
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requirements..."
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

      {filteredRequirements.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Requirements Found</h3>
          <p className="text-muted-foreground">
            {searchTerm
              ? "No requirements match your search criteria."
              : "No requirements found. Requirements will appear here once created."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRequirements.map((requirement) => (
            <Card key={requirement.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-xl">{requirement.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getSourceColor(requirement.source)}>
                        {requirement.source}
                      </Badge>
                      <Badge variant="outline">{requirement.source_ref}</Badge>
                      {requirement.created_at && (
                        <span className="text-sm text-muted-foreground">
                          Created {new Date(requirement.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {requirement.description}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedRequirement(requirement);
                      setShowGenerateDialog(true);
                      // Try to extract acceptance criteria from description
                      const desc = requirement.description || "";
                      const acMatch = desc.match(/Acceptance Criteria:?\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
                      if (acMatch) {
                        const acText = acMatch[1].trim();
                        // Split by numbered list or bullets
                        const acList = acText.split(/\n(?=\d+\.|\-|\*)/).map(line => line.replace(/^[\d\-\*\.\s]+/, "").trim()).filter(Boolean);
                        setAcceptanceCriteria(acList.join("\n"));
                      } else {
                        setAcceptanceCriteria("");
                      }
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Generate Test Cases
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/requirements/edit/${requirement.id}`)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/traceability?requirement=${requirement.id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Traceability
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Test Cases Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Test Cases from Requirement</DialogTitle>
            <DialogDescription>
              Generate comprehensive test cases using the full requirement-to-testcase pipeline
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequirement && (
            <div className="space-y-4">
              <div>
                <Label>Requirement ID</Label>
                <Input value={selectedRequirement.source_ref || selectedRequirement.id} disabled />
              </div>
              <div>
                <Label>Title</Label>
                <Input value={selectedRequirement.title} disabled />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={selectedRequirement.description} rows={4} disabled />
              </div>
              <div>
                <Label>Acceptance Criteria (one per line)</Label>
                <Textarea
                  value={acceptanceCriteria}
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  placeholder="Enter acceptance criteria, one per line..."
                  rows={6}
                />
              </div>

              {isGenerating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating test cases... This may take 30-60 seconds.</span>
                </div>
              )}

              {generationResult && (
                <Tabs defaultValue="test-cases" className="w-full">
                  <TabsList>
                    <TabsTrigger value="test-cases">Test Cases ({generationResult.test_cases?.length || 0})</TabsTrigger>
                    <TabsTrigger value="context">Requirement Context</TabsTrigger>
                    <TabsTrigger value="app-model">Synthetic App Model</TabsTrigger>
                    <TabsTrigger value="skeletons">Scenario Skeletons ({generationResult.scenario_skeletons?.length || 0})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="test-cases" className="space-y-4">
                    {generationResult.test_cases?.map((tc: any, idx: number) => (
                      <Card key={idx}>
                        <CardHeader>
                          <CardTitle className="text-lg">{tc.title}</CardTitle>
                          <div className="flex gap-2">
                            <Badge>{tc.kind || "functional"}</Badge>
                            <Badge variant="outline">{tc.priority || "medium"}</Badge>
                            {tc.tags?.map((tag: string) => (
                              <Badge key={tag} variant="secondary">{tag}</Badge>
                            ))}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">{tc.objective || tc.description}</p>
                          <div className="space-y-2">
                            <Label>Steps:</Label>
                            {tc.steps?.map((step: any, stepIdx: number) => (
                              <div key={stepIdx} className="border-l-2 border-primary pl-3 py-2">
                                <div className="font-medium">Step {step.step_number}: {step.action}</div>
                                {step.expected_result && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    Expected: {step.expected_result}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="context">
                    <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(generationResult.requirement_context, null, 2)}
                    </pre>
                  </TabsContent>
                  
                  <TabsContent value="app-model">
                    <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(generationResult.synthetic_app_model, null, 2)}
                    </pre>
                  </TabsContent>
                  
                  <TabsContent value="skeletons">
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {generationResult.scenario_skeletons?.map((skeleton: any, idx: number) => (
                        <Card key={idx}>
                          <CardHeader>
                            <CardTitle className="text-sm">{skeleton.title}</CardTitle>
                            <Badge>{skeleton.kind}</Badge>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm space-y-1">
                              <div><strong>Steps:</strong></div>
                              {skeleton.steps?.map((step: string, stepIdx: number) => (
                                <div key={stepIdx} className="pl-4">• {step}</div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowGenerateDialog(false);
              setGenerationResult(null);
              setAcceptanceCriteria("");
            }}>
              Close
            </Button>
            {!isGenerating && !generationResult && (
              <Button
                onClick={async () => {
                  if (!selectedRequirement) return;
                  
                  setIsGenerating(true);
                  setGenerationResult(null);
                  
                  try {
                    const acList = acceptanceCriteria.split("\n").filter(line => line.trim()).map(line => line.trim());
                    
                    const response = await fetch(API_ENDPOINTS.REQUIREMENTS_JIRA_TO_TESTCASES, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        requirement_id: selectedRequirement.source_ref || selectedRequirement.id,
                        title: selectedRequirement.title,
                        description: selectedRequirement.description,
                        acceptance_criteria: acList.length > 0 ? acList : undefined
                      })
                    });
                    
                    if (!response.ok) {
                      const error = await response.json().catch(() => ({ detail: response.statusText }));
                      throw new Error(error.detail || "Failed to generate test cases");
                    }
                    
                    const data = await response.json();
                    setGenerationResult(data);
                    toast.success(`Generated ${data.test_cases?.length || 0} test cases!`);
                  } catch (error: any) {
                    console.error("Generation error:", error);
                    toast.error(`Failed to generate: ${error.message}`);
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                className="gradient-primary"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Test Cases
              </Button>
            )}
            {generationResult && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!selectedRequirement) return;
                    
                    setIsGenerating(true);
                    setGenerationResult(null);
                    
                    try {
                      const acList = acceptanceCriteria.split("\n").filter(line => line.trim()).map(line => line.trim());
                      
                      const response = await fetch(API_ENDPOINTS.REQUIREMENTS_JIRA_TO_TESTCASES, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          requirement_id: selectedRequirement.source_ref || selectedRequirement.id,
                          title: selectedRequirement.title,
                          description: selectedRequirement.description,
                          acceptance_criteria: acList.length > 0 ? acList : undefined
                        })
                      });
                      
                      if (!response.ok) {
                        const error = await response.json().catch(() => ({ detail: response.statusText }));
                        throw new Error(error.detail || "Failed to generate test cases");
                      }
                      
                      const data = await response.json();
                      setGenerationResult(data);
                      toast.success(`Regenerated ${data.test_cases?.length || 0} test cases!`);
                    } catch (error: any) {
                      console.error("Generation error:", error);
                      toast.error(`Failed to regenerate: ${error.message}`);
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={isGenerating}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isGenerating ? "Regenerating..." : "Regenerate"}
                </Button>
                <Button
                  onClick={() => {
                    // Navigate to create test case page with generated data
                    navigate("/cases/create", {
                      state: {
                        generatedTestCases: generationResult.test_cases.map((tc: any) => ({
                          name: tc.title,
                          title: tc.title,
                          description: tc.objective || tc.description,
                          steps: tc.steps?.map((step: any) => ({
                            action: step.action,
                            expectedResult: step.expected_result
                          })) || []
                        }))
                      }
                    });
                    setShowGenerateDialog(false);
                  }}
                  className="gradient-primary"
                >
                  Create Test Cases ({generationResult.test_cases?.length || 0})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
