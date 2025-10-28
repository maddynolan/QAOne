import { AlertCircle, Bug, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const issues = [
  {
    id: 1,
    severity: "high",
    test: "Login Flow - Invalid Credentials",
    error: "AssertionError: Expected status 401, got 500",
    occurrences: 15,
    firstSeen: "2024-01-14",
  },
  {
    id: 2,
    severity: "medium",
    test: "User Profile - Update Avatar",
    error: "TimeoutError: Element not found within 5000ms",
    occurrences: 8,
    firstSeen: "2024-01-13",
  },
  {
    id: 3,
    severity: "low",
    test: "Dashboard - Load Metrics",
    error: "Warning: Deprecated API endpoint",
    occurrences: 3,
    firstSeen: "2024-01-15",
  },
];

export default function Triage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Triage</h1>
        <p className="text-muted-foreground mt-1">Review and prioritize test failures</p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Issues</TabsTrigger>
          <TabsTrigger value="high">High Priority</TabsTrigger>
          <TabsTrigger value="medium">Medium</TabsTrigger>
          <TabsTrigger value="low">Low</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {issues.map((issue) => (
            <Card key={issue.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant={
                          issue.severity === "high" ? "destructive" : 
                          issue.severity === "medium" ? "default" : 
                          "secondary"
                        }
                      >
                        {issue.severity === "high" && <AlertCircle className="h-3 w-3 mr-1" />}
                        {issue.severity === "medium" && <Bug className="h-3 w-3 mr-1" />}
                        {issue.severity === "low" && <Info className="h-3 w-3 mr-1" />}
                        {issue.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {issue.occurrences} occurrences
                      </span>
                    </div>
                    <CardTitle className="text-lg">{issue.test}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      First seen: {issue.firstSeen}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <code className="text-sm text-destructive">{issue.error}</code>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Investigate</Button>
                  <Button variant="outline" size="sm">Mark as Known</Button>
                  <Button variant="outline" size="sm">Create Ticket</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="high">
          {issues.filter(i => i.severity === "high").map((issue) => (
            <Card key={issue.id}>
              <CardHeader>
                <CardTitle>{issue.test}</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-sm">{issue.error}</code>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
