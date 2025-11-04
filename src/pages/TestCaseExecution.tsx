import { ArrowLeft, CheckCircle, XCircle, Clock, Upload, Camera, Link, Bug, ExternalLink, MessageSquare, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function TestCaseExecution() {
  const { runId, caseId } = useParams<{ runId: string; caseId: string }>();
  const navigate = useNavigate();
  const [testRun, setTestRun] = useState<any>(null);
  const [testCase, setTestCase] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [defects, setDefects] = useState<any[]>([]);
  const [isLinkingDefect, setIsLinkingDefect] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: any[] }>({});
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [showCommentBox, setShowCommentBox] = useState<{ [key: string]: boolean }>({});
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    if (runId && caseId) {
      loadTestRun();
      loadDefects();
    }
  }, [runId, caseId]);

  const loadTestRun = async () => {
    if (!runId) return;
    try {
      const response = await fetch(`http://localhost:8000/test-runs/${runId}`);
      if (!response.ok) {
        throw new Error("Failed to load test run");
      }
      const run = await response.json();
      setTestRun(run);
      
      // Find the specific test case
      const foundCase = run.testCases?.find((tc: any) => tc.id === caseId);
      if (foundCase) {
        setTestCase(foundCase);
      } else {
        toast.error("Test case not found");
        navigate(`/runs/${runId}`);
      }
      
      // Start execution if not already started
      if (run.status === "pending") {
        await startExecution();
      }
    } catch (error: any) {
      console.error("Error loading test run:", error);
      toast.error(`Failed to load test run: ${error.message}`);
      navigate(`/runs/${runId}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startExecution = async () => {
    if (!runId) return;
    try {
      const response = await fetch(`http://localhost:8000/test-runs/${runId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to start test run");
      }

      await loadTestRun();
    } catch (error: any) {
      toast.error(`Failed to start execution: ${error.message}`);
      console.error("Error starting execution:", error);
    }
  };

  const loadDefects = async () => {
    try {
      const response = await fetch("http://localhost:8000/defects");
      if (response.ok) {
        const data = await response.json();
        setDefects(data.defects || []);
      }
    } catch (error: any) {
      console.error("Error loading defects:", error);
    }
  };

  const loadComments = async (stepId?: string) => {
    if (!runId) return;
    try {
      let url = `http://localhost:8000/test-runs/${runId}/comments`;
      if (stepId) {
        url += `?step_id=${stepId}`;
      } else if (caseId) {
        url += `?case_id=${caseId}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const key = stepId || caseId || 'run';
        setComments(prev => ({ ...prev, [key]: data.comments || [] }));
      }
    } catch (error: any) {
      console.error("Error loading comments:", error);
    }
  };

  const addComment = async (commentText: string, stepId?: string) => {
    if (!commentText.trim() || !runId) return;
    
    try {
      const response = await fetch(`http://localhost:8000/test-runs/${runId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: commentText, case_id: caseId, step_id: stepId })
      });
      
      if (!response.ok) {
        throw new Error("Failed to add comment");
      }
      
      toast.success("Comment added!");
      const key = stepId || caseId || 'run';
      setNewComment(prev => ({ ...prev, [key]: '' }));
      setShowCommentBox(prev => ({ ...prev, [key]: false }));
      await loadComments(stepId);
    } catch (error: any) {
      toast.error(`Failed to add comment: ${error.message}`);
    }
  };

  const markStep = async (stepId: string, status: "passed" | "failed", error?: string) => {
    if (!testRun || !stepId || !runId) {
      toast.error("Invalid step ID or test run");
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:8000/test-runs/${runId}/steps/${stepId}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, error: error || "" })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to mark step: ${response.status} ${response.statusText}`);
      }
      
      toast.success(`Step marked as ${status}`);
      await loadTestRun();
    } catch (error: any) {
      toast.error(`Failed to mark step: ${error.message || "Unknown error"}`);
    }
  };

  const handleScreenshotUpload = async (stepId: string, file: File) => {
    if (!testRun || !runId) return;

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result?.toString().split(',')[1];
        if (!base64data) {
          throw new Error("Failed to read file as base64");
        }

        const response = await fetch(`http://localhost:8000/test-runs/${runId}/steps/${stepId}/screenshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            image: base64data,
            type: file.type || "image/png"
          })
        });

        if (!response.ok) {
          throw new Error("Failed to upload screenshot");
        }

        toast.success("Screenshot uploaded!");
        await loadTestRun();
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(`Failed to upload screenshot: ${error.message}`);
    }
  };

  const linkDefect = async (defectId: string, stepId: string) => {
    if (!testRun || !runId) return;
    
    try {
      const response = await fetch(`http://localhost:8000/test-runs/${runId}/steps/${stepId}/link-defect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defect_id: defectId })
      });
      
      if (!response.ok) {
        throw new Error("Failed to link defect");
      }

      toast.success("Defect linked successfully!");
      setIsLinkingDefect(null);
      await loadTestRun();
      await loadDefects();
    } catch (error: any) {
      toast.error(`Failed to link defect: ${error.message}`);
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId!]) {
      return "pending";
    }
    const stepData = testRun.stepResults[caseId!][stepIndex];
    return stepData?.status || "pending";
  };

  const getStepScreenshots = (stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId!]) {
      return [];
    }
    const stepData = testRun.stepResults[caseId!][stepIndex];
    return stepData?.screenshots || [];
  };

  const getStepDefects = (stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId!]) {
      return [];
    }
    const stepData = testRun.stepResults[caseId!][stepIndex];
    return stepData?.defects || [];
  };

  const getStepResultId = (stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId!]) {
      return null;
    }
    const stepData = testRun.stepResults[caseId!][stepIndex];
    return stepData?.step_id || null;
  };

  const getTestCaseStatus = () => {
    return testRun?.testCaseStatuses?.[caseId!] || "pending";
  };

  // Load comments for steps when test case is loaded
  useEffect(() => {
    if (testCase && testCase.steps && runId) {
      testCase.steps.forEach((_: any, stepIndex: number) => {
        const stepResultId = getStepResultId(stepIndex);
        if (stepResultId) {
          loadComments(stepResultId);
        }
      });
    }
  }, [testCase?.steps, runId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(`/runs/${runId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Run
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Loading Test Case</h3>
              <p className="text-muted-foreground">Please wait...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!testCase || !testRun) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(`/runs/${runId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Run
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Test Case Not Found</h3>
              <p className="text-muted-foreground">
                The test case you're looking for doesn't exist or has been deleted.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const testCaseStatus = getTestCaseStatus();
  const stepsCount = testCase.steps?.length || 0;
  const completedSteps = testCase.steps?.filter((_: any, idx: number) => {
    const status = getStepStatus(idx);
    return status === "passed" || status === "failed";
  }).length || 0;
  const progressPercent = stepsCount > 0 ? (completedSteps / stepsCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(`/runs/${runId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Test Run
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold gradient-text">{testCase.name}</h1>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>Status:</span>
            <Badge variant={
              testCaseStatus === "passed" ? "default" : 
              testCaseStatus === "failed" ? "destructive" : 
              "secondary"
            }>
              {testCaseStatus === "passed" && <CheckCircle className="h-3 w-3 mr-1" />}
              {testCaseStatus === "failed" && <XCircle className="h-3 w-3 mr-1" />}
              {testCaseStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
              {testCaseStatus}
            </Badge>
            <span>• {stepsCount} steps • {completedSteps} completed</span>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Test Case Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{completedSteps}/{stepsCount}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Case Description */}
      {testCase.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{testCase.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Test Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Test Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {testCase.steps?.map((step: any, stepIndex: number) => {
            const stepStatus = getStepStatus(stepIndex);
            const stepResultId = getStepResultId(stepIndex);
            const screenshots = getStepScreenshots(stepIndex);
            const stepDefects = getStepDefects(stepIndex);
            const stepNumber = stepIndex + 1;
            
            return (
              <div key={stepIndex} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={
                        stepStatus === "passed" ? "default" : 
                        stepStatus === "failed" ? "destructive" : 
                        "secondary"
                      }>
                        {stepStatus === "passed" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {stepStatus === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                        {stepStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        Step {stepNumber}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Action: {step.action}</p>
                      <p className="text-sm text-muted-foreground">
                        Expected: {step.expectedResult}
                      </p>
                    </div>
                  </div>
                  {testRun.status === "executing" && stepStatus === "pending" && stepResultId ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => markStep(stepResultId, "passed")}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Pass
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          const error = prompt("Enter error message (optional):");
                          markStep(stepResultId, "failed", error || "");
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Fail
                      </Button>
                    </div>
                  ) : null}
                </div>
                
                {/* Screenshot Upload */}
                {stepResultId && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={el => fileInputRefs.current[stepResultId] = el}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleScreenshotUpload(stepResultId, file);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRefs.current[stepResultId]?.click()}
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Upload Screenshot
                    </Button>
                  </div>
                )}
                
                {/* Display Screenshots */}
                {screenshots.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Screenshots:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {screenshots.map((screenshot: any, idx: number) => (
                        <div key={idx} className="relative group">
                          <img
                            src={screenshot.url || screenshot.metadata?.url}
                            alt={`Screenshot ${idx + 1}`}
                            className="rounded-lg border max-h-48 w-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              const url = screenshot.url || screenshot.metadata?.url;
                              if (url) {
                                window.open(url, '_blank');
                              }
                            }}
                          />
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const url = screenshot.url || screenshot.metadata?.url;
                                if (url) {
                                  window.open(url, '_blank');
                                }
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Defect Linking */}
                {stepResultId && (
                  <div className="flex items-center gap-2">
                    {isLinkingDefect === stepResultId ? (
                      <Select onValueChange={(defectId) => {
                        if (defectId) {
                          linkDefect(defectId, stepResultId);
                        }
                      }}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select defect" />
                        </SelectTrigger>
                        <SelectContent>
                          {defects.filter(d => !stepDefects.some((sd: any) => sd.id === d.id)).map(defect => (
                            <SelectItem key={defect.id} value={defect.id}>
                              {defect.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsLinkingDefect(stepResultId)}
                      >
                        <Link className="h-4 w-4 mr-1" />
                        Link Defect
                      </Button>
                    )}
                  </div>
                )}

                {/* Display Linked Defects */}
                {stepDefects.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Bug className="h-4 w-4" />
                      Linked Defects:
                    </p>
                    <div className="space-y-1">
                      {stepDefects.map((defect: any) => (
                        <div key={defect.id} className="flex items-center justify-between p-2 border rounded bg-background hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 flex-1">
                            <Badge variant={defect.priority === "critical" || defect.priority === "high" ? "destructive" : "secondary"}>
                              {defect.priority}
                            </Badge>
                            <span className="text-sm font-medium">{defect.title}</span>
                            {defect.description && (
                              <span className="text-xs text-muted-foreground ml-2 truncate">{defect.description}</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/defects/edit/${defect.id}`)}
                            className="ml-2"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      Comments ({comments[stepResultId || '']?.length || 0})
                    </p>
                    {stepResultId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowCommentBox(prev => ({ ...prev, [stepResultId]: !prev[stepResultId] }));
                          if (!comments[stepResultId]) {
                            loadComments(stepResultId);
                          }
                        }}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {showCommentBox[stepResultId] ? 'Cancel' : 'Add Comment'}
                      </Button>
                    )}
                  </div>
                  
                  {showCommentBox[stepResultId] && stepResultId && (
                    <div className="space-y-2 p-3 border rounded bg-background">
                      <Textarea
                        placeholder="Add a comment about this step..."
                        value={newComment[stepResultId] || ''}
                        onChange={(e) => setNewComment(prev => ({ ...prev, [stepResultId]: e.target.value }))}
                        className="min-h-[80px]"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowCommentBox(prev => ({ ...prev, [stepResultId]: false }));
                            setNewComment(prev => ({ ...prev, [stepResultId]: '' }));
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (stepResultId) {
                              addComment(newComment[stepResultId] || '', stepResultId);
                            }
                          }}
                        >
                          Post Comment
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Display Comments */}
                  {comments[stepResultId || ''] && comments[stepResultId || ''].length > 0 && (
                    <div className="space-y-2">
                      {comments[stepResultId || ''].map((comment: any) => (
                        <div key={comment.id} className="p-3 border rounded bg-background text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

