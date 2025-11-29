import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Sparkles, Loader2, Code, Check, X, Globe, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { customLLMService } from "@/lib/custom-llm-service";
import { dataStorageService, TestPlan } from "@/lib/data-storage";
import { testExecutionService } from "@/lib/test-execution-service";

interface TestStep {
  id: string;
  action: string;
  expectedResult: string;
}

export default function CreateTestCase() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = !!id;
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
    context: "",
    planId: ""
  });
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [allGeneratedTestCases, setAllGeneratedTestCases] = useState<any[]>([]);
  const [showGeneratedDialog, setShowGeneratedDialog] = useState(false);
  const [currentGeneratedIndex, setCurrentGeneratedIndex] = useState(0);
  const [isCreatingAll, setIsCreatingAll] = useState(false);
  
  // New UI enhancements state
  const [activeTab, setActiveTab] = useState<'requirement' | 'url-discover'>('requirement');
  const [testTypes, setTestTypes] = useState({
    manual: true,  // Default to manual test cases
    ui: false,
    api: false,
    perf: false,
    a11y: false,
    security: false
  });
  const [coverage, setCoverage] = useState<'smoke' | 'balanced' | 'deep'>('balanced');
  const [generatedTestPlan, setGeneratedTestPlan] = useState<any>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<any>(null);
  const [enhancedGeneratedTestCases, setEnhancedGeneratedTestCases] = useState<any[]>([]);
  const [selectedTestCases, setSelectedTestCases] = useState<Set<number>>(new Set());
  
  // Additional UI state for comprehensive test generation
  const [appType, setAppType] = useState<string>('');
  const [testStyle, setTestStyle] = useState<'gherkin' | 'step-list' | 'scenario' | 'bdd'>('step-list');
  const [environment, setEnvironment] = useState<'dev' | 'staging' | 'preprod' | 'prod'>('staging');
  const [teamTags, setTeamTags] = useState<string[]>([]);
  const [jiraTicket, setJiraTicket] = useState<string>('');
  const [outputTab, setOutputTab] = useState<'test-cases' | 'automation-code' | 'coverage'>('test-cases');
  const [automationCodeTab, setAutomationCodeTab] = useState<'ui' | 'api' | 'perf' | 'a11y' | 'security'>('ui');
  const [generatedAutomationCode, setGeneratedAutomationCode] = useState<{
    ui_playwright_ts?: string;
    api_pytest?: string;
    perf_k6?: string;
    a11y_script?: string;
    security_zap_config?: string;
  }>({});
  
  // Generation progress state
  const [generationProgress, setGenerationProgress] = useState<{
    currentStep: string;
    completedSteps: string[];
    testTypesGenerating: string[];
    currentType?: string;
  } | null>(null);

  // Handle generated test cases from AI generation
  useEffect(() => {
    const state = location.state as any;
    if (state?.generatedTestCases && Array.isArray(state.generatedTestCases) && state.generatedTestCases.length > 0) {
      console.log("Received generated test cases:", state.generatedTestCases);
      
      // Store all generated test cases
      setAllGeneratedTestCases(state.generatedTestCases);
      setCurrentGeneratedIndex(0);
      
      // Load first test case into form
      loadGeneratedTestCaseIntoForm(state.generatedTestCases[0]);
      
      // Show dialog if multiple test cases
      if (state.generatedTestCases.length > 1) {
        setShowGeneratedDialog(true);
        toast.success(`Generated ${state.generatedTestCases.length} test cases! Review and create them.`);
      } else {
        toast.success("Generated test case loaded. Review and save it.");
      }
      
      // Clear state to prevent re-loading on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Helper function to load a generated test case into the form
  const loadGeneratedTestCaseIntoForm = (testCase: any) => {
    setFormData({
      name: testCase.name || testCase.title || "",
      description: testCase.description || "",
      requirements: "",
      testType: "manual", // Default for AI-generated from jira-to-testcases
      complexity: "",
      context: "",
      planId: ""
    });
    
    // Convert steps format
    if (testCase.steps && Array.isArray(testCase.steps)) {
      const steps = testCase.steps.map((step: any, idx: number) => ({
        id: String(idx + 1),
        action: step.action || "",
        expectedResult: step.expectedResult || ""
      }));
      if (steps.length > 0) {
        setTestSteps(steps);
      } else {
        setTestSteps([{ id: "1", action: "", expectedResult: "" }]);
      }
    } else {
      setTestSteps([{ id: "1", action: "", expectedResult: "" }]);
    }
  };

  // Load test plans for dropdown
  useEffect(() => {
    const loadTestPlans = async () => {
      try {
        const plans = await dataStorageService.getTestPlans();
        setTestPlans(plans);
      } catch (error) {
        console.error("Error loading test plans:", error);
      }
    };
    loadTestPlans();
  }, []);

  // Load test case data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      setLoading(true);
      dataStorageService.getTestCase(id).then(testCase => {
        if (testCase) {
          setFormData({
            name: testCase.name || "",
            description: testCase.description || "",
            requirements: "",
            testType: testCase.testType || "",
            complexity: "",
            context: "",
            planId: testCase.planId || "" // Get plan ID from backend
          });
          // Set test steps if available
          if (testCase.steps && testCase.steps.length > 0) {
            setTestSteps(testCase.steps.map((step, idx) => ({
              id: String(idx + 1),
              action: step.action || "",
              expectedResult: step.expectedResult || ""
            })));
          }
          setLoading(false);
        } else {
          toast.error("Test case not found");
          navigate("/cases");
        }
      }).catch((error) => {
        console.error("Error loading test case:", error);
        toast.error("Failed to load test case");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [id, isEditMode, navigate]);

  // Create all generated test cases at once
  const handleCreateAllGenerated = async () => {
    if (allGeneratedTestCases.length === 0) return;
    
    setIsCreatingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const generatedCase of allGeneratedTestCases) {
        try {
          const testCaseData = {
            name: generatedCase.name || generatedCase.title || "",
            description: generatedCase.description || "",
            steps: (generatedCase.steps || []).map((step: any) => ({
              action: step.action || "",
              expectedResult: step.expectedResult || ""
            })),
            preconditions: [],
            testData: [],
            priority: "medium" as const,
            tags: [],
            testType: "manual",
            complexity: "medium",
            estimatedTime: 15
          };
          
          await dataStorageService.createTestCase(testCaseData);
          successCount++;
        } catch (error) {
          console.error("Error creating test case:", error);
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} test case${successCount > 1 ? 's' : ''}!`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} test case${errorCount > 1 ? 's' : ''}.`);
      }
      
      // Clear generated test cases and navigate back
      setAllGeneratedTestCases([]);
      setShowGeneratedDialog(false);
      navigate("/cases");
    } catch (error) {
      console.error("Error creating all test cases:", error);
      toast.error("Failed to create test cases");
    } finally {
      setIsCreatingAll(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading || isCreatingAll) return;
    
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

      if (isEditMode && id) {
        await dataStorageService.updateTestCase(id, testCaseData);
        // Assign to plan if selected
        if (formData.planId) {
          await fetch(`http://localhost:8000/test-cases/${id}/assign-plan`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: formData.planId })
          });
        }
        toast.success("Test case updated successfully!");
        navigate("/cases");
      } else {
        const created = await dataStorageService.createTestCase(testCaseData);
        
        // Check if we got a real UUID or fallback ID
        if (created.id && created.id.startsWith("tc_")) {
          toast.error("Test case creation failed - received fallback ID. Check server logs.");
          console.error("Backend returned fallback ID:", created.id);
          return;
        }
        
        // Assign to plan if selected
        if (formData.planId) {
          await fetch(`http://localhost:8000/test-cases/${created.id}/assign-plan`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: formData.planId })
          });
        }
        
        // If this was a generated test case, remove it from the list and move to next
        if (allGeneratedTestCases.length > 0) {
          // Remove the current test case from the list
          const updatedList = allGeneratedTestCases.filter((_, idx) => idx !== currentGeneratedIndex);
          setAllGeneratedTestCases(updatedList);
          
          if (updatedList.length > 0) {
            // Move to next test case (or first if we deleted the last one)
            const nextIndex = currentGeneratedIndex < updatedList.length ? currentGeneratedIndex : 0;
            setCurrentGeneratedIndex(nextIndex);
            loadGeneratedTestCaseIntoForm(updatedList[nextIndex]);
            toast.success(`Test case created! ${updatedList.length} remaining.`);
          } else {
            // All test cases created
            setShowGeneratedDialog(false);
            setAllGeneratedTestCases([]);
            toast.success("All test cases created successfully!");
            navigate("/cases");
          }
        } else {
          // Regular create (not from generated list)
          toast.success("Test case created and saved successfully!");
          navigate("/cases");
        }
      }
    } catch (error: any) {
      console.error("Error saving test case:", error);
      toast.error(`Failed to save test case: ${error.message || 'Unknown error'}`);
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
    
    // Initialize progress tracking
    const selectedTestTypes = Object.entries(testTypes)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type);
    
    const typeNames: Record<string, string> = {
      manual: "Manual Tests",
      ui: "UI Automation Tests",
      api: "API Tests",
      perf: "Performance Tests",
      a11y: "Accessibility Tests",
      security: "Security Tests"
    };
    
    setGenerationProgress({
      currentStep: "Initializing AI generation...",
      completedSteps: [],
      testTypesGenerating: selectedTestTypes.map(t => typeNames[t] || t),
      currentType: selectedTestTypes[0] ? typeNames[selectedTestTypes[0]] : undefined
    });
    
    try {
      console.log("Starting AI generation...");
      
      // NEW: Use enhanced endpoint if test types or coverage are set
      const useEnhanced = Object.values(testTypes).some(v => v) || coverage !== 'balanced';
      
      if (useEnhanced) {
        // Update progress: Starting generation
        setGenerationProgress(prev => prev ? {
          ...prev,
          currentStep: "Connecting to AI model...",
          completedSteps: ["Initialized"]
        } : null);
        
        // Use new enhanced endpoint with all parameters
        const response = await fetch("http://localhost:8000/ai/generate-tests-enhanced", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requirement: formData.description || formData.requirements,
            requirements: formData.requirements,
            testTypes: testTypes,
            coverage: coverage,
            context: formData.context,
            app_type: appType,
            test_style: testStyle,
            environment: environment,
            team_tags: teamTags,
            jira_ticket: jiraTicket,
            project_id: "11111111-1111-1111-1111-111111111111",
            org_id: "00000000-0000-0000-0000-000000000000"
          })
        });
        
        // Update progress: Processing response
        setGenerationProgress(prev => prev ? {
          ...prev,
          currentStep: "Processing AI response...",
          completedSteps: ["Initialized", "Connected to AI"]
        } : null);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        
        if (data.status === "success") {
          // Update progress: Finalizing
          setGenerationProgress(prev => prev ? {
            ...prev,
            currentStep: "Finalizing test cases...",
            completedSteps: ["Initialized", "Connected to AI", "Processing response", "Generating test cases"],
            currentType: undefined
          } : null);
          
          // Set test plan
          setGeneratedTestPlan(data.testPlan || null);
          
          // Set enhanced test cases
          const enhancedCases = (data.test_cases || []).map((tc: any) => ({
            title: tc.name || tc.title,
            name: tc.name || tc.title,
            description: tc.description || "",
            steps: tc.steps || [],
            tags: tc.tags || [],
            automationCode: tc.automationCode,
            priority: tc.priority || "medium",
            preconditions: tc.preconditions || [],
            testData: tc.testData || {}
          }));
          setEnhancedGeneratedTestCases(enhancedCases);
          
          // Extract automation code from response
          if (data.code) {
            setGeneratedAutomationCode({
              ui_playwright_ts: data.code.ui_playwright_ts || data.code.ui || '',
              api_pytest: data.code.api_pytest || data.code.api || '',
              perf_k6: data.code.perf_k6 || data.code.perf || '',
              a11y_script: data.code.a11y_script || data.code.a11y || '',
              security_zap_config: data.code.security_zap_config || data.code.security || ''
            });
          }
          
          // Also populate form with first test case (backward compatibility)
          if (enhancedCases.length > 0) {
            const firstCase = enhancedCases[0];
            setFormData(prev => ({
              ...prev,
              name: firstCase.title || prev.name,
              description: firstCase.description || prev.description
            }));
            
            if (firstCase.steps && firstCase.steps.length > 0) {
              const steps = firstCase.steps.map((step: any, idx: number) => ({
                id: String(idx + 1),
                action: step.action || "",
                expectedResult: step.expectedResult || step.expected || ""
              }));
              setTestSteps(steps);
            }
          }
          
          // Clear progress
          setGenerationProgress(null);
          toast.success(`Generated ${enhancedCases.length} test case(s) with ${coverage} coverage!`);
          return;
        }
      }
      
      // Check if this is an automated test that should be executed
      const isAutomated = formData.testType === "automated" || formData.testType === "ui" || formData.testType === "e2e";
      
      if (isAutomated) {
        // Generate and execute automated test
        toast.info("Generating automated test script and executing...");
        
        const response = await fetch("http://localhost:8000/ai/generate-and-execute-automated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name || "Generated Test",
            description: formData.description,
            app_url: formData.context || "https://www.saucedemo.com",
            project_id: "11111111-1111-1111-1111-111111111111",
            org_id: "00000000-0000-0000-0000-000000000000"
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(errorData.detail || "Failed to generate and execute test");
        }
        
        const data = await response.json();
        
        if (data.status === "success") {
          const result = data.execution_result;
          const statusEmoji = result.status === "passed" ? "✅" : "❌";
          
          toast.success(
            `${statusEmoji} Test ${result.status}! Duration: ${result.duration}ms`
          );
          
          // Update form with generated code
          setGeneratedCode(data.generated_code);
          
          // Update form with test name
          setFormData(prev => ({
            ...prev,
            name: formData.name || "Generated Test"
          }));
          
          // Show code review dialog with execution results
          setTestResults({
            status: "success",
            test_results: [{
              test_name: formData.name || "Generated Test",
              status: result.status,
              duration: result.duration,
              error: result.error,
              logs: result.logs || []
            }]
          });
          setShowCodeReview(true);
          
          // Optionally navigate to test run detail page
          if (data.test_run_id) {
            toast.info("Test run created! View results in dashboard.", {
              action: {
                label: "View Results",
                onClick: () => navigate(`/runs/${data.test_run_id}`)
              },
              duration: 5000
            });
          }
        } else {
          throw new Error(data.detail || "Test execution failed");
        }
      } else {
        // Regular manual test generation (existing flow)
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
        if (response.suggestions && response.suggestions.length > 0) {
          toast.info(`AI Suggestions: ${response.suggestions.join(", ")}`);
        }
      }
    } catch (error: any) {
      console.error("Error generating test case:", error);
      setGenerationProgress(null);
      toast.error(`Failed to generate test case: ${error.message}`);
    } finally {
      setIsGenerating(false);
      // Clear progress after a short delay to show completion
      setTimeout(() => setGenerationProgress(null), 1000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cases")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              {isEditMode ? "Edit Test Case" : "Create Test Case"}
            </h1>
            <p className="text-muted-foreground mt-1">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cases")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              {isEditMode ? "Edit Test Case" : "Create Test Case"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEditMode ? "Update test case details" : "Define a new test case"}
            </p>
          </div>
        </div>
        {!isEditMode && (
          <Button
            onClick={generateWithAI}
            disabled={isGenerating || !formData.description.trim()}
            className="gradient-primary"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'requirement' | 'url-discover')} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requirement" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Requirement → Test Cases
          </TabsTrigger>
          <TabsTrigger value="url-discover" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            URL → Auto-Discover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requirement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel: Input Form */}
            <div className="space-y-6">
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
              <Textarea
                id="description"
                placeholder="Describe what this test case validates..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan">Associated Test Plan</Label>
                <Select 
                  value={formData.planId || undefined} 
                  onValueChange={(value) => setFormData({ ...formData, planId: value === "none" ? "" : value })}
                >
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Select a test plan (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {testPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
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

        {/* Requirement Source */}
        <Card>
          <CardHeader>
            <CardTitle>Requirement Source</CardTitle>
            <CardDescription>Where is this requirement coming from?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requirements">Requirement / User Story / Spec / Ticket</Label>
              <Textarea
                id="requirements"
                placeholder="Paste user story, specification, or ticket description here..."
                value={formData.requirements}
                onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jira-ticket">Jira Ticket (Optional)</Label>
                <Input
                  id="jira-ticket"
                  placeholder="PROJ-123"
                  value={jiraTicket}
                  onChange={(e) => setJiraTicket(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requirement-url">URL (Optional)</Label>
                <Input
                  id="requirement-url"
                  placeholder="https://example.com/page"
                  type="url"
                  value={formData.context}
                  onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Type & Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Application Configuration</CardTitle>
            <CardDescription>Configure the application type and test style</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-type">Application Type</Label>
              <Select value={appType} onValueChange={setAppType}>
                <SelectTrigger id="app-type">
                  <SelectValue placeholder="Select application type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web App</SelectItem>
                  <SelectItem value="api-only">API-only Service</SelectItem>
                  <SelectItem value="mobile-webview">Mobile (Webview)</SelectItem>
                  <SelectItem value="desktop-web">Desktop (Web Front)</SelectItem>
                  <SelectItem value="crm">Salesforce-like CRM</SelectItem>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="admin-portal">Admin Portal</SelectItem>
                  <SelectItem value="banking">Banking/Financial</SelectItem>
                  <SelectItem value="analytics">Analytics Dashboard</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-style">Test Style Preset</Label>
                <Select value={testStyle} onValueChange={(value) => setTestStyle(value as any)}>
                  <SelectTrigger id="test-style">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="step-list">Step List</SelectItem>
                    <SelectItem value="gherkin">Gherkin (Given/When/Then)</SelectItem>
                    <SelectItem value="scenario">Scenario + Expected</SelectItem>
                    <SelectItem value="bdd">BDD-like</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select value={environment} onValueChange={(value) => setEnvironment(value as any)}>
                  <SelectTrigger id="environment">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Dev</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="preprod">Preprod</SelectItem>
                    <SelectItem value="prod">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-tags">Team/Service Tags (comma separated)</Label>
              <Input
                id="team-tags"
                placeholder="e.g., Payments, Onboarding, CRM Core"
                onChange={(e) => setTeamTags(e.target.value.split(',').map(t => t.trim()).filter(t => t))}
              />
              <p className="text-sm text-muted-foreground">
                Add team or service identifiers for better organization
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced: Test Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Test Types & Coverage</CardTitle>
            <CardDescription>Select what types of tests to generate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Test Types</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="test-type-manual"
                    checked={testTypes.manual}
                    onCheckedChange={(checked) => setTestTypes({...testTypes, manual: checked as boolean})}
                  />
                  <Label htmlFor="test-type-manual" className="font-normal cursor-pointer">Generate Manual tests</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="test-type-ui"
                    checked={testTypes.ui}
                    onCheckedChange={(checked) => setTestTypes({...testTypes, ui: checked as boolean})}
                  />
                  <Label htmlFor="test-type-ui" className="font-normal cursor-pointer">Generate UI tests</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="test-type-api"
                    checked={testTypes.api}
                    onCheckedChange={(checked) => setTestTypes({...testTypes, api: checked as boolean})}
                  />
                  <Label htmlFor="test-type-api" className="font-normal cursor-pointer">Generate API tests</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="test-type-perf"
                    checked={testTypes.perf}
                    onCheckedChange={(checked) => setTestTypes({...testTypes, perf: checked as boolean})}
                  />
                  <Label htmlFor="test-type-perf" className="font-normal cursor-pointer">Add perf checks</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="test-type-a11y"
                    checked={testTypes.a11y}
                    onCheckedChange={(checked) => setTestTypes({...testTypes, a11y: checked as boolean})}
                  />
                  <Label htmlFor="test-type-a11y" className="font-normal cursor-pointer">Add accessibility checks</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="test-type-security"
                    checked={testTypes.security}
                    onCheckedChange={(checked) => setTestTypes({...testTypes, security: checked as boolean})}
                  />
                  <Label htmlFor="test-type-security" className="font-normal cursor-pointer">Add security smoke tests</Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Coverage Level</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-16">Smoke</span>
                  <Slider
                    value={coverage === 'smoke' ? [0] : coverage === 'balanced' ? [50] : [100]}
                    onValueChange={(value) => {
                      if (value[0] < 33) setCoverage('smoke');
                      else if (value[0] < 67) setCoverage('balanced');
                      else setCoverage('deep');
                    }}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-16 text-right">Deep</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {coverage === 'smoke' && 'Quick smoke tests only - Fast execution, basic coverage'}
                  {coverage === 'balanced' && 'Balanced test coverage - Good mix of speed and depth'}
                  {coverage === 'deep' && 'Comprehensive regression suite - Maximum coverage, longer execution'}
                </p>
              </div>
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
            </div>

            {/* Right Panel: Output with Tabs */}
            <div className="space-y-4">
              {(enhancedGeneratedTestCases.length > 0 || generatedAutomationCode.ui_playwright_ts || generatedTestPlan) && (
                <Tabs value={outputTab} onValueChange={(value) => setOutputTab(value as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
                    <TabsTrigger value="automation-code">Automation Code</TabsTrigger>
                    <TabsTrigger value="coverage">Coverage & Risk</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Test Cases */}
                  <TabsContent value="test-cases" className="space-y-4">
                    {enhancedGeneratedTestCases.length > 0 ? (
                      <Card>
                        <CardHeader>
                          <CardTitle>Generated Test Cases</CardTitle>
                          <CardDescription>{enhancedGeneratedTestCases.length} test case(s) generated</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {enhancedGeneratedTestCases.map((tc, idx) => (
                      <div key={idx} className={`border rounded-lg p-3 space-y-2 ${selectedTestCases.has(idx) ? 'bg-primary/5 border-primary' : ''}`}>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedTestCases.has(idx)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedTestCases);
                              if (checked) {
                                newSelected.add(idx);
                                // Auto-populate test steps when selected
                                if (tc.steps && tc.steps.length > 0) {
                                  const formattedSteps = tc.steps.map((step: any, stepIdx: number) => ({
                                    id: String(stepIdx + 1),
                                    action: step.action || "",
                                    expectedResult: step.expectedResult || step.expected || ""
                                  }));
                                  setTestSteps(formattedSteps);
                                }
                              } else {
                                newSelected.delete(idx);
                              }
                              setSelectedTestCases(newSelected);
                            }}
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{tc.title || tc.name || `Test Case ${idx + 1}`}</h4>
                            {tc.tags && tc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tc.tags.map((tag: string, tagIdx: number) => (
                                  <Badge key={tagIdx} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {tc.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tc.description}</p>
                            )}
                            {tc.steps && tc.steps.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {tc.steps.length} step(s)
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {selectedTestCases.has(idx) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setEnhancedGeneratedTestCases(prev => prev.filter((_, i) => i !== idx));
                                  const newSelected = new Set(selectedTestCases);
                                  newSelected.delete(idx);
                                  // Adjust indices for remaining selections
                                  const adjusted = new Set<number>();
                                  newSelected.forEach(i => {
                                    if (i > idx) adjusted.add(i - 1);
                                    else adjusted.add(i);
                                  });
                                  setSelectedTestCases(adjusted);
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setSelectedTestCase(tc);
                                setGeneratedCode(tc.automationCode || '');
                                setManualSteps([]); // Clear manual steps, use selectedTestCase.steps instead
                                // Auto-populate test steps section
                                if (tc.steps && tc.steps.length > 0) {
                                  const formattedSteps = tc.steps.map((step: any, stepIdx: number) => ({
                                    id: String(stepIdx + 1),
                                    action: step.action || "",
                                    expectedResult: step.expectedResult || step.expected || ""
                                  }));
                                  setTestSteps(formattedSteps);
                                }
                                setShowCodeReview(true);
                              }}
                            >
                              <FileCode className="w-3 h-3 mr-1" />
                              Review
                            </Button>
                            {tc.automationCode && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedTestCase(tc);
                                  setGeneratedCode(tc.automationCode || '');
                                  setManualSteps([]); // Clear manual steps
                                  // Auto-populate test steps section
                                  if (tc.steps && tc.steps.length > 0) {
                                    const formattedSteps = tc.steps.map((step: any, stepIdx: number) => ({
                                      id: String(stepIdx + 1),
                                      action: step.action || "",
                                      expectedResult: step.expectedResult || step.expected || ""
                                    }));
                                    setTestSteps(formattedSteps);
                                  }
                                  setShowCodeReview(true);
                                }}
                              >
                                <Code className="w-3 h-3 mr-1" />
                                View Code
                              </Button>
                            )}
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={async () => {
                                // Save this test case directly
                                try {
                                  // Ensure steps exist (for performance/accessibility tests)
                                  let steps = tc.steps || [];
                                  if (steps.length === 0) {
                                    // Create placeholder steps for tests without steps
                                    steps = [{
                                      action: "Execute test case",
                                      expectedResult: "Test case completes successfully"
                                    }];
                                  }
                                  
                                  const testCaseData = {
                                    name: tc.title || tc.name || `Test Case ${idx + 1}`,
                                    description: tc.description || "",
                                    steps: steps.map((step: any, stepIdx: number) => ({
                                      id: String(stepIdx + 1),
                                      action: step.action || "",
                                      expectedResult: step.expectedResult || step.expected || ""
                                    })),
                                    priority: tc.priority || "medium",
                                    tags: tc.tags || [],
                                    testType: (() => {
                                      const tag = tc.tags?.find((t: string) => ["manual", "automation", "automated", "api", "performance", "accessibility", "security"].includes(t));
                                      if (!tag) return "manual";
                                      // Map "automation" to "automated" to match database enum
                                      return tag === "automation" ? "automated" : tag;
                                    })(),
                                    complexity: "medium",
                                    automationScript: tc.automationCode || undefined,
                                    preconditions: tc.preconditions || [],
                                    testData: tc.testData || {},
                                    estimatedTime: steps.length * 2
                                  };
                                  
                                  await dataStorageService.createTestCase(testCaseData);
                                  toast.success(`Test case "${tc.title || tc.name}" saved!`);
                                  
                                  // Remove from list
                                  setEnhancedGeneratedTestCases(prev => prev.filter((_, i) => i !== idx));
                                } catch (error: any) {
                                  toast.error(`Failed to save test case: ${error.message}`);
                                }
                              }}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                          ))}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center">
                          <p className="text-sm text-muted-foreground">
                            Generated test cases will appear here after AI generation.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Tab 2: Automation Code */}
                  <TabsContent value="automation-code" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Automation Code</CardTitle>
                        <CardDescription>Generated runnable code for different test domains</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Tabs value={automationCodeTab} onValueChange={(value) => setAutomationCodeTab(value as any)}>
                          <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="ui">UI (Playwright)</TabsTrigger>
                            <TabsTrigger value="api">API (pytest)</TabsTrigger>
                            <TabsTrigger value="perf">Performance (k6)</TabsTrigger>
                            <TabsTrigger value="a11y">Accessibility</TabsTrigger>
                            <TabsTrigger value="security">Security (ZAP)</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="ui" className="mt-4">
                            {generatedAutomationCode.ui_playwright_ts ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <Label>Playwright TypeScript</Label>
                                  <Button variant="outline" size="sm" onClick={() => {
                                    navigator.clipboard.writeText(generatedAutomationCode.ui_playwright_ts || '');
                                    toast.success('Code copied to clipboard');
                                  }}>
                                    Copy
                                  </Button>
                                </div>
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                                  <code>{generatedAutomationCode.ui_playwright_ts}</code>
                                </pre>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No UI automation code generated yet. Generate test cases with UI tests enabled.
                              </p>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="api" className="mt-4">
                            {generatedAutomationCode.api_pytest ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <Label>pytest API Tests</Label>
                                  <Button variant="outline" size="sm" onClick={() => {
                                    navigator.clipboard.writeText(generatedAutomationCode.api_pytest || '');
                                    toast.success('Code copied to clipboard');
                                  }}>
                                    Copy
                                  </Button>
                                </div>
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                                  <code>{generatedAutomationCode.api_pytest}</code>
                                </pre>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No API test code generated yet. Generate test cases with API tests enabled.
                              </p>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="perf" className="mt-4">
                            {generatedAutomationCode.perf_k6 ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <Label>k6 Performance Script</Label>
                                  <Button variant="outline" size="sm" onClick={() => {
                                    navigator.clipboard.writeText(generatedAutomationCode.perf_k6 || '');
                                    toast.success('Code copied to clipboard');
                                  }}>
                                    Copy
                                  </Button>
                                </div>
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                                  <code>{generatedAutomationCode.perf_k6}</code>
                                </pre>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No performance test code generated yet. Generate test cases with performance tests enabled.
                              </p>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="a11y" className="mt-4">
                            {generatedAutomationCode.a11y_script ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <Label>Accessibility Script (axe/Lighthouse)</Label>
                                  <Button variant="outline" size="sm" onClick={() => {
                                    navigator.clipboard.writeText(generatedAutomationCode.a11y_script || '');
                                    toast.success('Code copied to clipboard');
                                  }}>
                                    Copy
                                  </Button>
                                </div>
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                                  <code>{generatedAutomationCode.a11y_script}</code>
                                </pre>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No accessibility test code generated yet. Generate test cases with accessibility tests enabled.
                              </p>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="security" className="mt-4">
                            {generatedAutomationCode.security_zap_config ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <Label>Security Scan Config (ZAP/Burp)</Label>
                                  <Button variant="outline" size="sm" onClick={() => {
                                    navigator.clipboard.writeText(generatedAutomationCode.security_zap_config || '');
                                    toast.success('Code copied to clipboard');
                                  }}>
                                    Copy
                                  </Button>
                                </div>
                                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                                  <code>{generatedAutomationCode.security_zap_config}</code>
                                </pre>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No security test config generated yet. Generate test cases with security tests enabled.
                              </p>
                            )}
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab 3: Coverage & Risk */}
                  <TabsContent value="coverage" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Coverage & Risk Assessment</CardTitle>
                        <CardDescription>Requirements coverage and risk analysis</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {generatedTestPlan ? (
                          <>
                            {generatedTestPlan.scenarios && generatedTestPlan.scenarios.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold">Test Scenarios</Label>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                  {generatedTestPlan.scenarios.map((scenario: string, idx: number) => (
                                    <li key={idx} className="text-muted-foreground">{scenario}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {generatedTestPlan.riskTags && generatedTestPlan.riskTags.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold">Risk Tags</Label>
                                <div className="flex flex-wrap gap-2">
                                  {generatedTestPlan.riskTags.map((tag: string, idx: number) => (
                                    <Badge key={idx} variant={tag.startsWith('P0') ? 'destructive' : tag.startsWith('P1') ? 'default' : 'secondary'}>
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">Requirements Coverage</Label>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Covered Requirements</span>
                                  <Badge variant="default">{enhancedGeneratedTestCases.length} test case(s)</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Missing Flows</span>
                                  <Badge variant="outline">Review needed</Badge>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Coverage and risk assessment will appear here after AI generation.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}

              {!generatedTestPlan && enhancedGeneratedTestCases.length === 0 && !generatedAutomationCode.ui_playwright_ts && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Generated test plan and test cases will appear here after AI generation.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="url-discover" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>URL Auto-Discover</CardTitle>
              <CardDescription>Automatically discover and generate tests from a website URL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discover-url">Base URL</Label>
                <Input
                  id="discover-url"
                  placeholder="https://staging.example.com"
                  type="url"
                />
              </div>
              <div className="space-y-2">
                <Label>What to Discover</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="discover-crawl" defaultChecked />
                    <Label htmlFor="discover-crawl" className="font-normal cursor-pointer">Crawl & map pages</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="discover-ui" defaultChecked />
                    <Label htmlFor="discover-ui" className="font-normal cursor-pointer">Generate UI tests for key flows</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="discover-a11y" />
                    <Label htmlFor="discover-a11y" className="font-normal cursor-pointer">Run accessibility checks</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="discover-perf" />
                    <Label htmlFor="discover-perf" className="font-normal cursor-pointer">Basic performance smoke tests</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="discover-security" />
                    <Label htmlFor="discover-security" className="font-normal cursor-pointer">Basic security checks</Label>
                  </div>
                </div>
              </div>
              <Button className="w-full gradient-primary" disabled>
                <Sparkles className="h-4 w-4 mr-2" />
                Discover & Generate Tests
                <span className="ml-2 text-xs opacity-75">(Coming Soon)</span>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generation Progress Dialog */}
      <Dialog open={isGenerating && generationProgress !== null} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Test Cases with AI
            </DialogTitle>
            <DialogDescription>
              This may take 2-5 minutes depending on the number of test types selected
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Step */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Current Step</Label>
                <span className="text-xs text-muted-foreground">
                  {generationProgress?.currentType ? 
                    `Generating ${generationProgress.currentType} tests...` : 
                    'Processing...'}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm font-medium">{generationProgress?.currentStep || "Processing..."}</p>
              </div>
            </div>

            {/* Test Types Being Generated */}
            {generationProgress && generationProgress.testTypesGenerating.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Test Types to Generate</Label>
                <div className="grid grid-cols-2 gap-2">
                  {generationProgress.testTypesGenerating.map((type, idx) => {
                    const isCurrent = generationProgress.currentType === type;
                    const isCompleted = generationProgress.completedSteps.some(s => s.toLowerCase().includes(type.toLowerCase()));
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          isCurrent ? 'bg-primary/20 border border-primary' : 
                          isCompleted ? 'bg-green-500/10 border border-green-500/20' : 
                          'bg-muted'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : isCurrent ? (
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        )}
                        <span className="text-sm">{type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress Steps */}
            {generationProgress && generationProgress.completedSteps.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Progress</Label>
                <div className="space-y-2">
                  {generationProgress.completedSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-muted-foreground">{step}</span>
                    </div>
                  ))}
                  {generationProgress.currentStep && (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="font-medium">{generationProgress.currentStep}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Animated Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Generation Progress</span>
                <span>
                  {generationProgress?.completedSteps.length || 0} / {generationProgress ? generationProgress.completedSteps.length + 2 : 0} steps
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500 animate-pulse"
                  style={{
                    width: `${generationProgress ? 
                      Math.min(90, (generationProgress.completedSteps.length / (generationProgress.completedSteps.length + 2)) * 100) : 
                      0}%`
                  }}
                />
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> You can continue working in other tabs while test cases are being generated. 
                The process will continue in the background.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Case Review Dialog */}
      <Dialog open={showCodeReview} onOpenChange={setShowCodeReview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Review Generated Test Case
            </DialogTitle>
            <DialogDescription>
              {selectedTestCase ? (
                <>
                  Review the AI-generated test case: <strong>{selectedTestCase.title || selectedTestCase.name}</strong>
                </>
              ) : (
                "Review the AI-generated test case below. Click 'Approve & Save' to save, or 'Cancel' to close."
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Test Case Info */}
          {selectedTestCase && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div>
                <strong className="text-sm">Title:</strong>
                <p className="text-sm mt-1">{selectedTestCase.title || selectedTestCase.name}</p>
              </div>
              {selectedTestCase.description && (
                <div>
                  <strong className="text-sm">Description:</strong>
                  <p className="text-sm mt-1">{selectedTestCase.description}</p>
                </div>
              )}
              {selectedTestCase.tags && selectedTestCase.tags.length > 0 && (
                <div>
                  <strong className="text-sm">Tags:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedTestCase.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Steps Section - Always show if available */}
          {((selectedTestCase && selectedTestCase.steps && selectedTestCase.steps.length > 0) || manualSteps.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Test Steps ({selectedTestCase?.steps?.length || manualSteps.length})</Label>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                {/* Only show selectedTestCase.steps if available, otherwise manualSteps - no duplicates */}
                {(selectedTestCase?.steps && selectedTestCase.steps.length > 0 ? selectedTestCase.steps : manualSteps).map((step: any, idx: number) => (
                  <Card key={idx} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                          {step.step_number || idx + 1}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div>
                            <strong className="text-sm font-medium">Action:</strong>
                            <p className="text-sm mt-1">{step.action || step.action}</p>
                          </div>
                          <div>
                            <strong className="text-sm font-medium">Expected Result:</strong>
                            <p className="text-sm mt-1 text-green-600 dark:text-green-400">
                              {step.expected_result || step.expectedResult || step.expected || ""}
                            </p>
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

          {/* Automation Code Section - Show if available */}
          {generatedCode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Generated Automation Code (Playwright)</Label>
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
              onClick={async () => {
                try {
                  // Save the selected test case
                  if (selectedTestCase) {
                    // Ensure steps exist (for performance/accessibility tests)
                    let steps = selectedTestCase.steps || [];
                    if (steps.length === 0) {
                      // Create placeholder steps for tests without steps
                      steps = [{
                        action: "Execute test case",
                        expectedResult: "Test case completes successfully"
                      }];
                    }
                    
                    const testCaseData = {
                      name: selectedTestCase.title || selectedTestCase.name || "Generated Test Case",
                      description: selectedTestCase.description || "",
                      steps: steps.map((step: any, stepIdx: number) => ({
                        id: String(stepIdx + 1),
                        action: step.action || "",
                        expectedResult: step.expectedResult || step.expected || ""
                      })),
                      priority: selectedTestCase.priority || "medium",
                      tags: selectedTestCase.tags || [],
                      testType: (() => {
                        const tag = selectedTestCase.tags?.find((t: string) => ["manual", "automation", "automated", "api", "performance", "accessibility", "security"].includes(t));
                        if (!tag) return "manual";
                        // Map "automation" to "automated" to match database enum
                        return tag === "automation" ? "automated" : tag;
                      })(),
                      complexity: "medium",
                      automationScript: generatedCode || selectedTestCase.automationCode || undefined,
                      preconditions: selectedTestCase.preconditions || [],
                      testData: selectedTestCase.testData || {},
                      estimatedTime: steps.length * 2
                    };
                    
                    console.log("Saving test case:", testCaseData);
                    const result = await dataStorageService.createTestCase(testCaseData);
                    console.log("Save result:", result);
                    
                    toast.success("Test case saved successfully!");
                    
                    // Remove from list
                    setEnhancedGeneratedTestCases(prev => prev.filter(tc => 
                      (tc.title || tc.name) !== (selectedTestCase.title || selectedTestCase.name)
                    ));
                    
                    setShowCodeReview(false);
                    setGeneratedCode("");
                    setManualSteps([]);
                    setSelectedTestCase(null);
                  } else if (manualSteps.length > 0) {
                    // Save manual steps as a test case
                    const testCaseData = {
                      name: formData.name || "Generated Test Case",
                      description: formData.description || "",
                      steps: manualSteps.map((step: any, stepIdx: number) => ({
                        id: String(stepIdx + 1),
                        action: step.action || "",
                        expectedResult: step.expectedResult || step.expected || ""
                      })),
                      priority: "medium",
                      tags: ["manual"],
                      testType: "manual",
                      complexity: "medium",
                      automationScript: generatedCode || undefined,
                      preconditions: [],
                      testData: {},
                      estimatedTime: manualSteps.length * 2
                    };
                    
                    console.log("Saving manual test case:", testCaseData);
                    const result = await dataStorageService.createTestCase(testCaseData);
                    console.log("Save result:", result);
                    
                    toast.success("Test case saved successfully!");
                    setShowCodeReview(false);
                    setGeneratedCode("");
                    setManualSteps([]);
                  } else {
                    // Fallback: Store generated code in formData
                    if (generatedCode) {
                      setFormData(prev => ({
                        ...prev,
                        context: generatedCode
                      }));
                    }
                    setShowCodeReview(false);
                    toast.success("Test code approved! Click 'Create Test Case' to save.");
                  }
                } catch (error: any) {
                  console.error("Error saving test case:", error);
                  toast.error(`Failed to save test case: ${error.message || 'Unknown error'}`);
                }
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve & Save Test Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Test Cases Review Dialog */}
      <Dialog open={showGeneratedDialog} onOpenChange={setShowGeneratedDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Review Generated Test Cases ({allGeneratedTestCases.length})
            </DialogTitle>
            <DialogDescription>
              {allGeneratedTestCases.length > 1 
                ? `You have ${allGeneratedTestCases.length} generated test cases. Review them and choose to create all or individual ones.`
                : "Review the generated test case below."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {allGeneratedTestCases.length > 1 && (
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prev = currentGeneratedIndex > 0 ? currentGeneratedIndex - 1 : allGeneratedTestCases.length - 1;
                      setCurrentGeneratedIndex(prev);
                      loadGeneratedTestCaseIntoForm(allGeneratedTestCases[prev]);
                    }}
                  >
                    ← Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Test Case {currentGeneratedIndex + 1} of {allGeneratedTestCases.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = currentGeneratedIndex < allGeneratedTestCases.length - 1 ? currentGeneratedIndex + 1 : 0;
                      setCurrentGeneratedIndex(next);
                      loadGeneratedTestCaseIntoForm(allGeneratedTestCases[next]);
                    }}
                  >
                    Next →
                  </Button>
                </div>
                <Button
                  onClick={handleCreateAllGenerated}
                  disabled={isCreatingAll}
                  className="gradient-primary"
                >
                  {isCreatingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating All...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create All {allGeneratedTestCases.length} Test Cases
                    </>
                  )}
                </Button>
              </div>
            )}

            {allGeneratedTestCases.length > 0 && (
              <div className="space-y-2">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">
                    {allGeneratedTestCases[currentGeneratedIndex]?.name || allGeneratedTestCases[currentGeneratedIndex]?.title || "Test Case"}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {allGeneratedTestCases[currentGeneratedIndex]?.description || "No description"}
                  </p>
                  {allGeneratedTestCases[currentGeneratedIndex]?.steps && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Steps:</h5>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        {allGeneratedTestCases[currentGeneratedIndex].steps.map((step: any, idx: number) => (
                          <li key={idx} className="text-muted-foreground">
                            <span className="font-medium">{step.action || "Action"}</span>
                            {step.expectedResult && (
                              <span className="block ml-4 text-xs">Expected: {step.expectedResult}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {allGeneratedTestCases.length > 1 && (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {allGeneratedTestCases.map((tc, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded border cursor-pointer transition-colors ${
                      idx === currentGeneratedIndex ? "border-primary bg-primary/10" : "border-muted"
                    }`}
                    onClick={() => {
                      setCurrentGeneratedIndex(idx);
                      loadGeneratedTestCaseIntoForm(tc);
                    }}
                  >
                    <div className="text-sm font-medium truncate">
                      {tc.name || tc.title || `Test Case ${idx + 1}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {tc.steps?.length || 0} steps
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGeneratedDialog(false);
                setAllGeneratedTestCases([]);
              }}
            >
              Close
            </Button>
            <Button
              onClick={async () => {
                // Create the current test case using the same logic as form submit
                if (allGeneratedTestCases.length === 0) {
                  setShowGeneratedDialog(false);
                  return;
                }
                
                const currentCase = allGeneratedTestCases[currentGeneratedIndex];
                try {
                  const testCaseData = {
                    name: currentCase.name || currentCase.title || "",
                    description: currentCase.description || "",
                    steps: (currentCase.steps || []).map((step: any) => ({
                      action: step.action || "",
                      expectedResult: step.expectedResult || ""
                    })),
                    preconditions: [],
                    testData: [],
                    priority: "medium" as const,
                    tags: [],
                    testType: "manual",
                    complexity: "medium",
                    estimatedTime: 15
                  };
                  
                  const created = await dataStorageService.createTestCase(testCaseData);
                  
                  // Check if we got a real UUID or fallback ID
                  if (created.id && created.id.startsWith("tc_")) {
                    toast.error("Test case creation failed - received fallback ID. Check server logs.");
                    return;
                  }
                  
                  // Remove the created test case from the list
                  const updatedList = allGeneratedTestCases.filter((_, idx) => idx !== currentGeneratedIndex);
                  setAllGeneratedTestCases(updatedList);
                  
                  if (updatedList.length > 0) {
                    // Move to next test case (or first if we deleted the last one)
                    const nextIndex = currentGeneratedIndex < updatedList.length ? currentGeneratedIndex : 0;
                    setCurrentGeneratedIndex(nextIndex);
                    loadGeneratedTestCaseIntoForm(updatedList[nextIndex]);
                    toast.success(`Test case created! ${updatedList.length} remaining.`);
                  } else {
                    // All test cases created
                    setShowGeneratedDialog(false);
                    setAllGeneratedTestCases([]);
                    toast.success("All test cases created successfully!");
                    navigate("/cases");
                  }
                } catch (error: any) {
                  console.error("Error creating test case:", error);
                  toast.error(`Failed to create test case: ${error.message || 'Unknown error'}`);
                }
              }}
              className="gradient-primary"
            >
              Create Current Test Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
