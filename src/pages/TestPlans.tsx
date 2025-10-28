import { Plus, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const testPlans = [
  { id: 1, name: "Regression Test Suite", status: "active", tests: 45, lastRun: "2024-01-15" },
  { id: 2, name: "API Integration Tests", status: "active", tests: 32, lastRun: "2024-01-14" },
  { id: 3, name: "E2E User Flows", status: "draft", tests: 28, lastRun: "2024-01-10" },
  { id: 4, name: "Performance Tests", status: "active", tests: 15, lastRun: "2024-01-13" },
];

export default function TestPlans() {
  const navigate = useNavigate();

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

      <div className="grid gap-4">
        {testPlans.map((plan) => (
          <Card key={plan.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.tests} tests • Last run {plan.lastRun}
                  </p>
                </div>
                <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                  {plan.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/runs")}
                >
                  View Results
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
