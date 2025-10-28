import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TestRunDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const run = {
    id: id,
    plan: "API Integration Tests",
    status: "completed",
    progress: 100,
    passed: 28,
    failed: 4,
    pending: 0,
    startedAt: "2024-01-15 09:15 AM",
    completedAt: "2024-01-15 09:45 AM",
    duration: "30m 15s",
  };

  const testCases = [
    { id: 1, name: "GET /api/users - Success", status: "passed", duration: "245ms" },
    { id: 2, name: "POST /api/users - Create User", status: "passed", duration: "512ms" },
    { id: 3, name: "PUT /api/users/:id - Update User", status: "failed", duration: "1.2s", error: "Expected status 200, got 500" },
    { id: 4, name: "DELETE /api/users/:id - Delete User", status: "passed", duration: "340ms" },
    { id: 5, name: "GET /api/products - List Products", status: "passed", duration: "189ms" },
    { id: 6, name: "POST /api/auth/login - Invalid Credentials", status: "failed", duration: "456ms", error: "Response timeout" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/runs")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold gradient-text">{run.plan}</h1>
          <p className="text-muted-foreground mt-1">Test Run #{run.id}</p>
        </div>
        <Badge 
          variant={
            run.status === "running" ? "default" : 
            run.status === "completed" ? "secondary" : 
            "destructive"
          }
          className="text-base px-4 py-2"
        >
          {run.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{run.passed + run.failed + run.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{run.passed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{run.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{run.duration}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-muted-foreground">Started</p>
              <p className="font-medium">{run.startedAt}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Completed</p>
              <p className="font-medium">{run.completedAt}</p>
            </div>
          </div>
          <Progress value={run.progress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({testCases.length})</TabsTrigger>
              <TabsTrigger value="passed">Passed ({testCases.filter(t => t.status === "passed").length})</TabsTrigger>
              <TabsTrigger value="failed">Failed ({testCases.filter(t => t.status === "failed").length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {testCases.map((test) => (
                <div key={test.id} className="flex items-start justify-between p-4 rounded-lg border">
                  <div className="flex items-start gap-3 flex-1">
                    {test.status === "passed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{test.name}</h4>
                      {test.error && (
                        <p className="text-sm text-destructive mt-1">{test.error}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">{test.duration}</p>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="passed" className="space-y-3">
              {testCases.filter(t => t.status === "passed").map((test) => (
                <div key={test.id} className="flex items-start justify-between p-4 rounded-lg border">
                  <div className="flex items-start gap-3 flex-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">{test.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{test.duration}</p>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="failed" className="space-y-3">
              {testCases.filter(t => t.status === "failed").map((test) => (
                <div key={test.id} className="flex items-start justify-between p-4 rounded-lg border border-destructive/50">
                  <div className="flex items-start gap-3 flex-1">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">{test.name}</h4>
                      {test.error && (
                        <p className="text-sm text-destructive mt-1">{test.error}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">{test.duration}</p>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
