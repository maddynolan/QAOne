import { Plus, Search, Filter, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dataStorageService, TestPlan } from "@/lib/data-storage";

export default function TestPlans() {
  const navigate = useNavigate();
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandingPlanId, setExpandingPlanId] = useState<string | null>(null);

  useEffect(() => {
    loadTestPlans();
  }, []);

  const loadTestPlans = async () => {
    try {
      setIsLoading(true);
      const plans = await dataStorageService.getTestPlans();
      setTestPlans(plans);
    } catch (error) {
      console.error('Error loading test plans:', error);
      toast.error('Failed to load test plans');
    } finally {
      setIsLoading(false);
    }
  };

  const expandPlanWithAI = async (planId: string) => {
    setExpandingPlanId(planId);
    try {
      toast.loading("Expanding test plan with AI...");
      const response = await fetch(`http://localhost:8000/ai/generate-tests?planId=${planId}&mode=quick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      if (data.status === "success" || data.cases) {
        toast.dismiss();
        toast.success("Plan expanded with additional test scenarios!");
        await loadTestPlans(); // Reload plans
        navigate(`/plans/edit/${planId}`, { 
          state: { generatedCases: data.cases || [] } 
        });
      } else {
        toast.error("Failed to expand plan");
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setExpandingPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Plans</h1>
          <p className="text-muted-foreground mt-1">Manage and organize your test plans</p>
        </div>
        <Button className="gradient-primary" onClick={() => navigate("/plans/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search test plans..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading test plans...</div>
      ) : testPlans.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No test plans found. Create your first test plan to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {testPlans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.testCases?.length || 0} test cases
                      {plan.createdAt && ` • Created ${new Date(plan.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                    {plan.status || "draft"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => expandPlanWithAI(plan.id)}
                    disabled={expandingPlanId === plan.id}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {expandingPlanId === plan.id ? "Expanding..." : "Expand with AI"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/plans/edit/${plan.id}`)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate("/runs")}
                  >
                    Run Tests
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
