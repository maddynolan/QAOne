import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { dataStorageService, TestCase } from "@/lib/data-storage";

export default function SelectTestCases() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [testPlanId, setTestPlanId] = useState<string>("");
  const [testPlans, setTestPlans] = useState<any[]>([]);

  // Get form data from previous step
  const formData = location.state || {};
  const preSelectedPlanId = formData.planId || "";

  // Redirect if no form data (user navigated directly)
  useEffect(() => {
    if (!formData || !formData.name) {
      toast.error("Please start from the test run creation page");
      navigate("/runs/create");
      return;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          loadTestCases(),
          loadTestPlans()
        ]);
        if (preSelectedPlanId) {
          setTestPlanId(preSelectedPlanId);
          await loadTestCasesFromPlan(preSelectedPlanId);
        }
      } catch (error) {
        console.error("Error initializing:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const loadTestPlans = async () => {
    try {
      const plans = await dataStorageService.getTestPlans();
      setTestPlans(plans || []);
    } catch (error) {
      console.error("Error loading test plans:", error);
      setTestPlans([]);
    }
  };

  const loadTestCases = async () => {
    try {
      const cases = await dataStorageService.getTestCases();
      console.log("Loaded test cases:", cases?.length || 0, cases);
      setAllTestCases(cases || []);
    } catch (error) {
      console.error("Error loading test cases:", error);
      toast.error("Failed to load test cases");
      setAllTestCases([]);
    }
  };

  const loadTestCasesFromPlan = async (planId: string) => {
    try {
      // Load test cases linked to this plan
      const cases = await dataStorageService.getTestCases(planId);
      if (cases && cases.length > 0) {
        const planCaseIds = new Set(cases.map((tc: any) => tc.id));
        setSelectedCaseIds(planCaseIds);
        toast.success(`Loaded ${planCaseIds.size} test cases from plan`);
      } else {
        toast.info("No test cases found in this test plan");
      }
    } catch (error) {
      console.error("Error loading test cases from plan:", error);
      toast.error("Failed to load test cases from plan");
    }
  };

  const handlePlanChange = (planId: string) => {
    setTestPlanId(planId);
    if (planId) {
      loadTestCasesFromPlan(planId);
    } else {
      setSelectedCaseIds(new Set());
    }
  };

  const filteredTestCases = allTestCases.filter((tc) => {
    // Search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const name = (tc.name || tc.title || "").toLowerCase();
      const description = (tc.description || "").toLowerCase();
      const tags = (tc.tags || []).map((tag: string) => String(tag).toLowerCase());
      
      const matchesSearch = 
        name.includes(query) ||
        description.includes(query) ||
        tags.some(tag => tag.includes(query));
      
      if (!matchesSearch) {
        return false;
      }
    }

    // Priority filter
    if (priorityFilter !== "all") {
      const tcPriority = (tc.priority || "").toLowerCase();
      if (tcPriority !== priorityFilter.toLowerCase()) {
        return false;
      }
    }

    // Tag filter
    if (tagFilter !== "all") {
      const tags = tc.tags || [];
      if (!tags.includes(tagFilter)) {
        return false;
      }
    }

    return true;
  });

  const allTags = Array.from(
    new Set(allTestCases.flatMap(tc => tc.tags || []))
  ).sort();

  const toggleTestCase = (caseId: string) => {
    const newSelected = new Set(selectedCaseIds);
    if (newSelected.has(caseId)) {
      newSelected.delete(caseId);
    } else {
      newSelected.add(caseId);
    }
    setSelectedCaseIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCaseIds.size === filteredTestCases.length) {
      setSelectedCaseIds(new Set());
    } else {
      setSelectedCaseIds(new Set(filteredTestCases.map(tc => tc.id)));
    }
  };

  const selectedTestCases = allTestCases.filter(tc => selectedCaseIds.has(tc.id));

  const handleCreateTestRun = async () => {
    if (selectedCaseIds.size === 0) {
      toast.error("Please select at least one test case");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create test run with selected test case IDs
      const response = await fetch("http://localhost:8000/test-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          planId: formData.planId || null,
          environment: formData.environment,
          branch: formData.branch || null,
          commit: formData.commit || null,
          tags: formData.tags || [],
          test_case_ids: Array.from(selectedCaseIds)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create test run");
      }

      const { id } = await response.json();
      toast.success(`Test run created with ${selectedCaseIds.size} test case(s)!`);
      navigate(`/runs/${id}`);
    } catch (error: any) {
      console.error("Error creating test run:", error);
      toast.error(`Failed to create test run: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground">Loading test cases...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Select Test Cases</h1>
          <p className="text-muted-foreground mt-2">
            Step 2 of 2: Choose test cases for this run
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {selectedCaseIds.size} selected
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Available Test Cases */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Test Cases</CardTitle>
              <CardDescription>
                {filteredTestCases.length} test case(s) found
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search test cases..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tag</Label>
                    <Select value={tagFilter} onValueChange={setTagFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tags</SelectItem>
                        {allTags.map(tag => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                  <div className="space-y-2">
                    <Label>Load from Test Plan</Label>
                    <Select value={testPlanId || "none"} onValueChange={(value) => handlePlanChange(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a test plan" />
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

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCaseIds.size === filteredTestCases.length && filteredTestCases.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label className="cursor-pointer" onClick={toggleSelectAll}>
                    Select All ({filteredTestCases.length})
                  </Label>
                </div>
              </div>

              {/* Test Cases List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredTestCases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No test cases found
                  </div>
                ) : (
                  filteredTestCases.map((testCase) => (
                    <Card
                      key={testCase.id}
                      className={`cursor-pointer transition-colors ${
                        selectedCaseIds.has(testCase.id)
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleTestCase(testCase.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedCaseIds.has(testCase.id)}
                            onCheckedChange={() => toggleTestCase(testCase.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold truncate">{testCase.name || testCase.title || "Untitled Test Case"}</h3>
                              <Badge
                                variant={
                                  testCase.priority === "critical"
                                    ? "destructive"
                                    : testCase.priority === "high"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {testCase.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {testCase.description}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {testCase.steps?.length || 0} steps
                              </span>
                              {testCase.tags?.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {testCase.tags && testCase.tags.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{testCase.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Selected Test Cases */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selected Test Cases</CardTitle>
              <CardDescription>
                {selectedCaseIds.size} test case(s) selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {selectedTestCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No test cases selected
                </div>
              ) : (
                selectedTestCases.map((testCase) => (
                  <div
                    key={testCase.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{testCase.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {testCase.steps?.length || 0} steps
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleTestCase(testCase.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => navigate("/runs/create", { state: formData })}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleCreateTestRun}
          disabled={isSubmitting || selectedCaseIds.size === 0}
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            "Creating..."
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Create Test Run ({selectedCaseIds.size})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

