import { Plus, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const defects = [
  { 
    id: 1, 
    title: "Login button not responding", 
    severity: "critical", 
    priority: "high",
    status: "open", 
    assignedTo: "John Doe",
    testCase: "User Login Flow",
    reportedDate: "2024-01-15",
    environment: "QA"
  },
  { 
    id: 2, 
    title: "Payment API returns 500 error", 
    severity: "blocker", 
    priority: "critical",
    status: "in-progress", 
    assignedTo: "Jane Smith",
    testCase: "Payment Processing",
    reportedDate: "2024-01-14",
    environment: "Production"
  },
  { 
    id: 3, 
    title: "UI alignment issue on mobile", 
    severity: "minor", 
    priority: "low",
    status: "fixed", 
    assignedTo: "Bob Johnson",
    testCase: "Responsive Design",
    reportedDate: "2024-01-13",
    environment: "Staging"
  },
  { 
    id: 4, 
    title: "Password validation missing", 
    severity: "major", 
    priority: "high",
    status: "retest", 
    assignedTo: "Alice Brown",
    testCase: "User Registration",
    reportedDate: "2024-01-12",
    environment: "Dev"
  },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "blocker": return "destructive";
    case "critical": return "destructive";
    case "major": return "default";
    case "minor": return "secondary";
    default: return "outline";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "open": return "destructive";
    case "in-progress": return "default";
    case "fixed": return "secondary";
    case "retest": return "default";
    case "verified": return "outline";
    case "closed": return "outline";
    default: return "outline";
  }
};

export default function Defects() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Defects</h1>
          <p className="text-muted-foreground mt-1">Track and manage bugs and issues</p>
        </div>
        <Button className="gradient-primary" onClick={() => navigate("/defects/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Report Defect
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search defects..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid gap-4">
        {defects.map((defect) => (
          <Card key={defect.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-xl">{defect.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Test Case: {defect.testCase} • Reported {defect.reportedDate} • {defect.environment}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Badge variant={getSeverityColor(defect.severity)}>
                    {defect.severity}
                  </Badge>
                  <Badge variant={getStatusColor(defect.status)}>
                    {defect.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Assigned to: <span className="font-medium text-foreground">{defect.assignedTo}</span>
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/defects/edit/${defect.id}`)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/defects/${defect.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
