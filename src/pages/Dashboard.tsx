import { CheckCircle2, Clock, TrendingUp, AlertTriangle, FileText, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const recentRuns = [
  { id: 1, name: "API Integration Tests", status: "running", progress: 65, tests: "32/50" },
  { id: 2, name: "E2E User Flow Tests", status: "passed", progress: 100, tests: "45/45" },
  { id: 3, name: "Security Scan", status: "failed", progress: 100, tests: "12/15" },
  { id: 4, name: "Performance Tests", status: "queued", progress: 0, tests: "0/20" },
];

const statusColors = {
  running: "bg-primary text-primary-foreground",
  passed: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
  queued: "bg-muted text-muted-foreground",
};

const Dashboard = () => {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitor your test automation in real-time
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tests"
          value="1,284"
          change="+12%"
          changeType="positive"
          icon={FileText}
          variant="default"
        />
        <MetricCard
          title="Success Rate"
          value="94.2%"
          change="+2.1%"
          changeType="positive"
          icon={CheckCircle2}
          variant="success"
        />
        <MetricCard
          title="Active Runs"
          value="3"
          icon={Play}
          variant="primary"
        />
        <MetricCard
          title="Failed Tests"
          value="24"
          change="-8%"
          changeType="positive"
          icon={AlertTriangle}
          variant="destructive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Recent Test Runs</CardTitle>
            <CardDescription>
              Monitor your ongoing and completed test executions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{run.name}</h4>
                    <Badge className={statusColors[run.status as keyof typeof statusColors]}>
                      {run.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{run.tests} tests</span>
                    {run.status === "running" && (
                      <div className="flex items-center gap-2 flex-1">
                        <Progress value={run.progress} className="h-2 flex-1" />
                        <span>{run.progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <CardHeader>
            <CardTitle>Test Coverage Trends</CardTitle>
            <CardDescription>
              Your test coverage over the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">API Coverage</span>
                  <span className="font-medium">87%</span>
                </div>
                <Progress value={87} className="h-3" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">UI Coverage</span>
                  <span className="font-medium">92%</span>
                </div>
                <Progress value={92} className="h-3" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">E2E Coverage</span>
                  <span className="font-medium">78%</span>
                </div>
                <Progress value={78} className="h-3" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Security Tests</span>
                  <span className="font-medium">95%</span>
                </div>
                <Progress value={95} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Start a new test run or create a test plan
              </CardDescription>
            </div>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              className="gradient-primary border-0 hover:shadow-glow transition-all"
              onClick={() => navigate("/runs")}
            >
              <Play className="mr-2 h-4 w-4" />
              Run All Tests
            </Button>
            <Button variant="outline" onClick={() => navigate("/plans/create")}>
              <FileText className="mr-2 h-4 w-4" />
              Create Test Plan
            </Button>
            <Button variant="outline" onClick={() => navigate("/settings")}>
              <Clock className="mr-2 h-4 w-4" />
              Schedule Tests
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
