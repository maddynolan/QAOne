import { ArrowLeft, CheckCircle, XCircle, Clock, Upload, Camera, Link, Bug, ExternalLink, MessageSquare, User, Calendar, GitBranch, ChevronDown, ChevronUp, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dataStorageService } from "@/lib/data-storage";
import { toast } from "sonner";
import { TraceabilityMatrix } from "@/components/TraceabilityMatrix";

export default function TestRunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [testRun, setTestRun] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [defects, setDefects] = useState<any[]>([]);
  const [isLinkingDefect, setIsLinkingDefect] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<{type: 'step' | 'global', stepId?: string} | null>(null);
  const [comments, setComments] = useState<{ [key: string]: any[] }>({}); // key: step_id or case_id or 'run'
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [showCommentBox, setShowCommentBox] = useState<{ [key: string]: boolean }>({});
  const [expandedTestCases, setExpandedTestCases] = useState<{ [key: string]: boolean }>({});
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const globalScreenshotInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (id) {
      loadTestRun(id);
      loadDefects();
      loadComments(id); // Load run-level comments
      // Poll for updates every 5 seconds if run is executing
      const interval = setInterval(() => {
        if (testRun && testRun.status === "executing") {
          loadTestRun(id);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [id, testRun?.status]);

  useEffect(() => {
    // Load comments for test cases when they're loaded
    if (testRun && testRun.testCases && id) {
      testRun.testCases.forEach((tc: any) => {
        loadComments(id, tc.id);
      });
    }
  }, [testRun?.testCases, id]);

  const loadTestRun = async (runId: string) => {
    try {
      const run = await dataStorageService.getTestRun(runId);
      console.log("🔍 Test Run Data:", run);
      console.log("🔍 Test Cases:", run?.testCases);
      if (run?.testCases) {
        run.testCases.forEach((tc: any, idx: number) => {
          console.log(`🔍 Test Case ${idx}:`, tc);
          console.log(`🔍 Test Case ${idx} Steps:`, tc.steps);
        });
      }
      setTestRun(run);
    } catch (error: any) {
      console.error("Error loading test run:", error);
      toast.error(`Failed to load test run: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDefects = async () => {
    try {
      const allDefects = await dataStorageService.getDefects();
      setDefects(allDefects);
    } catch (error: any) {
      console.error("Error loading defects:", error);
    }
  };

  const loadComments = async (runId: string, caseId?: string, stepId?: string) => {
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

  const addComment = async (runId: string, commentText: string, caseId?: string, stepId?: string) => {
    if (!commentText.trim()) return;
    
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
      await loadComments(runId, caseId, stepId);
    } catch (error: any) {
      toast.error(`Failed to add comment: ${error.message}`);
    }
  };

  const startExecution = async () => {
    if (!testRun || testRun.status !== "pending") return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:8000/test-runs/${testRun.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to start test run");
      }

      toast.success("Test execution started!");
      // Reload test run to get updated status and data
      await loadTestRun(testRun.id);
    } catch (error: any) {
      toast.error(`Failed to start execution: ${error.message}`);
      console.error("Error starting execution:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startTestCaseExecution = async (caseId: string) => {
    if (!testRun) return;
    
    // If test run is not started yet, start it first
    if (testRun.status === "pending") {
      await startExecution();
      // Wait a bit for the run to be updated
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadTestRun(testRun.id);
    }
    
    // Navigate to test case execution page
    navigate(`/runs/${testRun.id}/cases/${caseId}/execute`);
  };

  const toggleTestCase = (caseId: string) => {
    setExpandedTestCases(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  const markStep = async (stepId: string, status: "passed" | "failed", error?: string) => {
    if (!testRun || !stepId) {
      toast.error("Invalid step ID or test run");
      return;
    }
    
    try {
      console.log(`Marking step ${stepId} as ${status} for run ${testRun.id}`);
      
      const response = await fetch(`http://localhost:8000/test-runs/${testRun.id}/steps/${stepId}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, error: error || "" })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to mark step: ${response.status} ${response.statusText}`, errorText);
        throw new Error(errorText || `Failed to mark step: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log("Step marked successfully:", result);
      
      toast.success(`Step marked as ${status}`);
      await loadTestRun(testRun.id);
    } catch (error: any) {
      console.error("Error marking step:", error);
      toast.error(`Failed to mark step: ${error.message || "Unknown error"}`);
    }
  };

  const handleScreenshotUpload = async (stepId: string | null, file: File, isGlobal: boolean = false) => {
    if (!testRun) return;
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        
        const endpoint = isGlobal 
          ? `http://localhost:8000/test-runs/${testRun.id}/screenshot`
          : `http://localhost:8000/test-runs/${testRun.id}/steps/${stepId}/screenshot`;
        
        const response = await fetch(endpoint, {
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
        await loadTestRun(testRun.id);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(`Failed to upload screenshot: ${error.message}`);
    }
  };

  const linkDefect = async (defectId: string, stepId?: string) => {
    if (!testRun) return;
    
    try {
      const endpoint = stepId
        ? `http://localhost:8000/test-runs/${testRun.id}/steps/${stepId}/link-defect`
        : `http://localhost:8000/test-runs/${testRun.id}/link-defect`;
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defect_id: defectId })
      });
      
      if (!response.ok) {
        throw new Error("Failed to link defect");
      }
      
      toast.success("Defect linked successfully!");
      await loadTestRun(testRun.id);
      setIsLinkingDefect(null);
      setLinkTarget(null);
    } catch (error: any) {
      toast.error(`Failed to link defect: ${error.message}`);
    }
  };

  const getStepStatus = (caseId: string, stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId]) {
      return "pending";
    }
    const stepData = testRun.stepResults[caseId][stepIndex];
    return stepData?.status || "pending";
  };

  const getStepScreenshots = (caseId: string, stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId]) {
      return [];
    }
    const stepData = testRun.stepResults[caseId][stepIndex];
    return stepData?.screenshots || [];
  };

  const getStepDefects = (caseId: string, stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId]) {
      return [];
    }
    const stepData = testRun.stepResults[caseId][stepIndex];
    return stepData?.defects || [];
  };

  const getStepResultId = (caseId: string, stepIndex: number) => {
    if (!testRun?.stepResults || !testRun.stepResults[caseId]) {
      return null;
    }
    const stepData = testRun.stepResults[caseId][stepIndex];
    return stepData?.step_id || null;
  };

  const getTestCaseStatus = (caseId: string) => {
    if (!testRun?.testCaseStatuses) {
      return "pending";
    }
    return testRun.testCaseStatuses[caseId] || "pending";
  };

  const toggleTestCaseSelection = (caseId: string) => {
    const newSelected = new Set(selectedTestCases);
    if (newSelected.has(caseId)) {
      newSelected.delete(caseId);
    } else {
      newSelected.add(caseId);
    }
    setSelectedTestCases(newSelected);
  };

  const toggleSelectAll = () => {
    if (!testRun?.testCases) return;
    if (selectedTestCases.size === testRun.testCases.length) {
      setSelectedTestCases(new Set());
    } else {
      setSelectedTestCases(new Set(testRun.testCases.map((tc: any) => tc.id)));
    }
  };

  const executeSelectedTestCases = async () => {
    if (selectedTestCases.size === 0) {
      toast.error("Please select at least one test case");
      return;
    }

    if (testRun.status === "pending") {
      await startExecution();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadTestRun(testRun.id);
    }

    try {
      const caseIds = Array.from(selectedTestCases);
      const response = await fetch(`http://localhost:8000/test-runs/${testRun.id}/execute-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_ids: caseIds })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to execute selected test cases");
      }

      toast.success(`Executing ${caseIds.length} test case(s)...`);
      await loadTestRun(testRun.id);
      setSelectedTestCases(new Set());
    } catch (error: any) {
      toast.error(`Failed to execute test cases: ${error.message}`);
      console.error("Error executing selected test cases:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/runs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Runs
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Loading Test Run</h3>
              <p className="text-muted-foreground">Please wait...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!testRun) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/runs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Runs
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Test Run Not Found</h3>
              <p className="text-muted-foreground">
                The test run you're looking for doesn't exist or has been deleted.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSteps = testRun.testCases?.reduce((sum: number, tc: any) => sum + (tc.steps?.length || 0), 0) || 0;
  const completedSteps = testRun.summary?.passed + testRun.summary?.failed || 0;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/runs')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Test Runs
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold gradient-text">{testRun.name}</h1>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>Status:</span>
            <Badge variant={testRun.status === "completed" ? "default" : testRun.status === "failed" ? "destructive" : "secondary"}>
              {testRun.status}
            </Badge>
            {testRun.planId && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
                onClick={() => navigate(`/plans/${testRun.planId}`)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Test Plan
              </Button>
            )}
            {testRun.started_at && <span>• Started: {new Date(testRun.started_at).toLocaleString()}</span>}
            {testRun.completed_at && <span>• Completed: {new Date(testRun.completed_at).toLocaleString()}</span>}
          </div>
        </div>
        {testRun.status === "pending" && (
          <Button 
            onClick={startExecution}
            disabled={isLoading}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            title="Start execution for all test cases"
          >
            {isLoading ? "Starting..." : "Start Execution"}
          </Button>
        )}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Test Run Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{totalSteps}</div>
              <div className="text-muted-foreground">Total Steps</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{testRun.summary?.passed || 0}</div>
              <div className="text-muted-foreground">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{testRun.summary?.failed || 0}</div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{testRun.summary?.skipped || 0}</div>
              <div className="text-muted-foreground">Skipped</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{completedSteps}/{totalSteps}</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Attachments and Defects Section */}
      <Card>
        <CardHeader>
          <CardTitle>Attachments and Defects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Screenshots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Screenshots</h3>
              <input
                ref={globalScreenshotInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleScreenshotUpload(null, file, true);
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => globalScreenshotInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-1" />
                Upload Screenshot
              </Button>
            </div>
            {testRun.globalScreenshots && testRun.globalScreenshots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {testRun.globalScreenshots.map((screenshot: any, idx: number) => (
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
            ) : (
              <p className="text-sm text-muted-foreground">No screenshots uploaded</p>
            )}
          </div>

          {/* Defects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Defects</h3>
              <div className="flex items-center gap-2">
                {isLinkingDefect === "global" ? (
                  <Select onValueChange={(defectId) => {
                    if (defectId) {
                      linkDefect(defectId);
                    }
                  }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select defect" />
                    </SelectTrigger>
                    <SelectContent>
                      {defects.filter(d => !testRun.globalDefects?.some((gd: any) => gd.id === d.id)).map(defect => (
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
                    onClick={() => setIsLinkingDefect("global")}
                  >
                    <Link className="h-4 w-4 mr-1" />
                    Link Defect
                  </Button>
                )}
              </div>
            </div>
            {testRun.globalDefects && testRun.globalDefects.length > 0 ? (
              <div className="space-y-2">
                {testRun.globalDefects.map((defect: any) => (
                  <div key={defect.id} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={defect.priority === "critical" || defect.priority === "high" ? "destructive" : "secondary"}>
                          {defect.priority}
                        </Badge>
                        <span className="font-medium">{defect.title}</span>
                      </div>
                      {defect.description && (
                        <p className="text-sm text-muted-foreground mt-1">{defect.description}</p>
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
            ) : (
              <p className="text-sm text-muted-foreground">No defects linked</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Execution and Traceability */}
      <Tabs defaultValue="execution" className="space-y-4">
        <TabsList>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="traceability">Traceability</TabsTrigger>
        </TabsList>

        {/* Execution Tab */}
        <TabsContent value="execution" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Test Cases</h2>
            {testRun.testCases && testRun.testCases.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedTestCases.size === testRun.testCases.length && testRun.testCases.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label className="text-sm text-muted-foreground cursor-pointer" onClick={toggleSelectAll}>
                    Select All ({testRun.testCases.length})
                  </label>
                </div>
                {selectedTestCases.size > 0 && (
                  <Button
                    size="sm"
                    onClick={executeSelectedTestCases}
                    disabled={testRun.status === "completed"}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Selected ({selectedTestCases.size})
                  </Button>
                )}
              </div>
            )}
          </div>
        {!testRun.testCases || testRun.testCases.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Test Cases</h3>
                <p className="text-muted-foreground">No test cases found in this run.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          testRun.testCases.map((testCase: any) => {
            const testCaseStatus = getTestCaseStatus(testCase.id);
            const isExpanded = expandedTestCases[testCase.id] || false;
            const stepsCount = testCase.steps?.length || 0;
            
              return (
              <Card key={testCase.id}>
                  <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex items-center gap-3">
                      <Checkbox
                        checked={selectedTestCases.has(testCase.id)}
                        onCheckedChange={() => toggleTestCaseSelection(testCase.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTestCase(testCase.id)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {testCase.name}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({stepsCount} step{stepsCount !== 1 ? 's' : ''})
                          </span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{testCase.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                      {(testRun.status === "pending" || testRun.status === "executing") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startTestCaseExecution(testCase.id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                  </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-4">
                    <h3 className="font-semibold">Test Steps</h3>
                    <div className="space-y-3">
                    {testCase.steps && testCase.steps.length > 0 ? (
                      testCase.steps.map((step: any, stepIndex: number) => {
                      const stepStatus = getStepStatus(testCase.id, stepIndex);
                      const stepResultId = getStepResultId(testCase.id, stepIndex);
                      const screenshots = getStepScreenshots(testCase.id, stepIndex);
                      const stepDefects = getStepDefects(testCase.id, stepIndex);
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
                                  Expected: {step.expectedResult || step.expected || "N/A"}
                                </p>
                              </div>
                            </div>
                            {testRun.status === "executing" && stepStatus === "pending" && stepResultId ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => {
                                    if (stepResultId) {
                                      markStep(stepResultId, "passed");
                                    } else {
                                      toast.error("Step ID not found");
                                    }
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Pass
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    if (stepResultId) {
                                      const error = prompt("Enter error message (optional):");
                                      markStep(stepResultId, "failed", error || "");
                                    } else {
                                      toast.error("Step ID not found");
                                    }
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Fail
                                </Button>
                              </div>
                            ) : testRun.status === "executing" && stepStatus === "pending" && !stepResultId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  // Initialize step by starting execution
                                  if (testRun.status === "pending") {
                                    await startExecution();
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    await loadTestRun(testRun.id);
                                  } else {
                                    // Create step result manually
                                    try {
                                      const response = await fetch(`http://localhost:8000/test-runs/${testRun.id}/steps/initialize`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          case_id: testCase.id,
                                          step_index: stepIndex
                                        })
                                      });
                                      if (response.ok) {
                                        await loadTestRun(testRun.id);
                                        toast.success("Step initialized");
                                      }
                                    } catch (error) {
                                      toast.error("Failed to initialize step");
                                    }
                                  }
                                }}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start Step
                              </Button>
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
                                      loadComments(id || '', testCase.id, stepResultId);
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
                                      if (id && stepResultId) {
                                        addComment(id, newComment[stepResultId] || '', testCase.id, stepResultId);
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
                    </div>
              );
            })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No test steps available for this test case.</p>
                <p className="text-sm mt-2">Steps will appear here once the test case is executed.</p>
              </div>
            )}
          </div>
            </CardContent>
          )}
        </Card>
      );
    })
  )}
        </TabsContent>

        {/* Traceability Tab */}
        <TabsContent value="traceability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Traceability Matrix</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Requirements → Test Cases → Test Runs → Defects
              </p>
            </CardHeader>
            <CardContent>
              <TraceabilityMatrix testRun={testRun} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
