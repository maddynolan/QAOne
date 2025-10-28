import { Play, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const testRuns = [
  { 
    id: 1, 
    plan: "Regression Test Suite", 
    status: "running", 
    progress: 65,
    passed: 29,
    failed: 3,
    pending: 13,
    startedAt: "2024-01-15 10:30 AM"
  },
  { 
    id: 2, 
    plan: "API Integration Tests", 
    status: "completed", 
    progress: 100,
    passed: 28,
    failed: 4,
    pending: 0,
    startedAt: "2024-01-15 09:15 AM"
  },
  { 
    id: 3, 
    plan: "E2E User Flows", 
    status: "failed", 
    progress: 100,
    passed: 18,
    failed: 10,
    pending: 0,
    startedAt: "2024-01-14 03:45 PM"
  },
];

export default function TestRuns() {
  const navigate = useNavigate();

  const handleStopRun = (runId: number) => {
    toast.success("Test run stopped successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Runs</h1>
          <p className="text-muted-foreground mt-1">Monitor your test execution history</p>
        </div>
        <Button className="gradient-primary" onClick={() => navigate("/plans")}>
          <Play className="h-4 w-4 mr-2" />
          Start New Run
        </Button>
      </div>

      <div className="grid gap-4">
        {testRuns.map((run) => (
          <Card key={run.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-xl">{run.plan}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Started {run.startedAt}</p>
                  </div>
                </div>
                <Badge 
                  variant={
                    run.status === "running" ? "default" : 
                    run.status === "completed" ? "secondary" : 
                    "destructive"
                  }
                >
                  {run.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{run.progress}%</span>
                </div>
                <Progress value={run.progress} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-500">{run.passed}</p>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-red-500">{run.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold text-yellow-500">{run.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/runs/${run.id}`)}
                >
                  View Details
                </Button>
                {run.status === "running" && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleStopRun(run.id)}
                  >
                    Stop Run
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
