import { Plus, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const testCases = [
  { id: 1, name: "User Login Flow", priority: "high", status: "active", plan: "Regression Test Suite", lastRun: "2024-01-15" },
  { id: 2, name: "API Authentication", priority: "high", status: "active", plan: "API Integration Tests", lastRun: "2024-01-14" },
  { id: 3, name: "Payment Processing", priority: "critical", status: "active", plan: "E2E User Flows", lastRun: "2024-01-15" },
  { id: 4, name: "User Registration", priority: "medium", status: "active", plan: "Regression Test Suite", lastRun: "2024-01-13" },
  { id: 5, name: "Password Reset", priority: "medium", status: "draft", plan: "Regression Test Suite", lastRun: "2024-01-10" },
  { id: 6, name: "Product Search", priority: "low", status: "active", plan: "E2E User Flows", lastRun: "2024-01-12" },
];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical": return "destructive";
    case "high": return "default";
    case "medium": return "secondary";
    default: return "outline";
  }
};

export default function TestCases() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Cases</h1>
          <p className="text-muted-foreground mt-1">Create and manage individual test cases</p>
        </div>
        <Button className="gradient-primary" onClick={() => navigate("/cases/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Test Case
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search test cases..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid gap-4">
        {testCases.map((testCase) => (
          <Card key={testCase.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-xl">{testCase.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Plan: {testCase.plan} • Last run {testCase.lastRun}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={getPriorityColor(testCase.priority)}>
                    {testCase.priority}
                  </Badge>
                  <Badge variant={testCase.status === "active" ? "default" : "secondary"}>
                    {testCase.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/cases/edit/${testCase.id}`)}
                >
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/runs")}
                >
                  Run Test
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/runs")}
                >
                  View History
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
