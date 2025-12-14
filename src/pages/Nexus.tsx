/**
 * Nexus Autonomous Exploratory Testing Page
 * 
 * An autonomous testing agent that discovers severe, non-obvious defects
 * in applications with zero human input after start.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Play,
  Pause,
  Square,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  Bug,
  Clock,
  Download,
  RefreshCw,
  Zap
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";

interface NexusSession {
  session_id: string;
  status: "running" | "complete" | "paused";
  defects_found: number;
  risk_heatmap: Record<string, string>;
  time_elapsed_seconds: number;
  proof?: string;
  defects: Array<{
    defect_type: string;
    severity: string;
    title: string;
    description: string;
    page_url?: string;
  }>;
  current_activity?: string;
  progress?: {
    capabilities_tested: number;
    total_capabilities: number;
    flows_executed: number;
    pages_crawled: number;
    iterations: number;
    progress_percentage: number;
    estimated_remaining_seconds: number;
  };
  recent_activity?: Array<{
    timestamp: string;
    action: string;
    capability?: string;
    iteration: number;
    elapsed_seconds: number;
  }>;
  last_update?: string;
}

export default function Nexus() {
  const [appUrl, setAppUrl] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<NexusSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [redTeamMode, setRedTeamMode] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Poll for session updates
  useEffect(() => {
    if (sessionId && isRunning) {
      const interval = setInterval(async () => {
        await fetchSessionStatus();
      }, 3000); // Poll every 3 seconds
      setPollInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [sessionId, isRunning]);

  const startSession = async () => {
    if (!appUrl.trim()) {
      toast.error("Please enter an application URL");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/nexus/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_url: appUrl,
          max_duration_minutes: 30,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to start session");
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setIsRunning(true);
      toast.success("Nexus autonomous exploration started!");
      
      // Start polling
      await fetchSessionStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to start Nexus session");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessionStatus = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/nexus/status/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch session status");
      }

      const data = await response.json();
      setSession(data);
      
      if (data.status === "complete") {
        setIsRunning(false);
        toast.success("Nexus exploration completed!");
      }
    } catch (error: any) {
      console.error("Error fetching session status:", error);
    }
  };

  const stopSession = async () => {
    if (!sessionId) {
      toast.error("No active session to stop");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/nexus/stop/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to stop session");
      }

      const data = await response.json();
      setIsRunning(false);
      toast.success(data.message || "Nexus session stopped successfully");
      
      // Refresh status to show final state
      await fetchSessionStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to stop Nexus session");
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "critical":
        return "bg-red-600";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            Blaze - Autonomous Testing
          </h1>
          <p className="text-muted-foreground mt-2">
            Ex-Google Principal SDET agent that autonomously discovers severe defects with zero human input
          </p>
        </div>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Start Autonomous Testing</CardTitle>
          <CardDescription>
            Enter an application URL and Blaze will autonomously explore, test, and find defects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-url">Application URL</Label>
            <Input
              id="app-url"
              placeholder="https://example.com"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="red-team"
              checked={redTeamMode}
              onCheckedChange={setRedTeamMode}
              disabled={isRunning}
            />
            <Label htmlFor="red-team" className="cursor-pointer">
              Red Team Mode (Offensive Testing)
            </Label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={startSession}
              disabled={isLoading || isRunning || !appUrl.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Blaze
                </>
              )}
            </Button>

            {isRunning && (
              <Button
                onClick={stopSession}
                variant="outline"
                disabled={!isRunning}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Status */}
      {session && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="text-2xl font-bold capitalize">{session.status}</p>
                </div>
                {session.status === "running" ? (
                  <Activity className="h-8 w-8 text-primary animate-pulse" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Defects Found</p>
                  <p className="text-2xl font-bold">{session.defects_found}</p>
                </div>
                <Bug className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Time Elapsed</p>
                  <p className="text-2xl font-bold">{formatTime(session.time_elapsed_seconds)}</p>
                  {session.progress && session.progress.estimated_remaining_seconds > 0 && session.status === "running" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Est. remaining: {formatTime(session.progress.estimated_remaining_seconds)}
                    </p>
                  )}
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Capabilities Tested</p>
                  <p className="text-2xl font-bold">
                    {session.progress?.capabilities_tested || Object.keys(session.risk_heatmap).length}
                  </p>
                  {session.progress && (
                    <p className="text-xs text-muted-foreground mt-1">
                      of {session.progress.total_capabilities || 0}
                    </p>
                  )}
                </div>
                <Target className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Current Activity & Progress */}
      {session && session.status === "running" && (
        <Card>
          <CardHeader>
            <CardTitle>Current Activity</CardTitle>
            <CardDescription>
              Real-time progress of Nexus exploration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">What's happening now:</span>
                <span className="text-sm text-muted-foreground">
                  {session.current_activity || "Initializing..."}
                </span>
              </div>
              {session.progress && (
                <>
                  <Progress 
                    value={session.progress.progress_percentage || 0} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{session.progress.progress_percentage?.toFixed(1) || 0}% complete</span>
                    <span>Iteration {session.progress.iterations || 0}</span>
                  </div>
                </>
              )}
            </div>

            {session.progress && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Flows Executed</p>
                  <p className="text-lg font-semibold">{session.progress.flows_executed || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pages Crawled</p>
                  <p className="text-lg font-semibold">{session.progress.pages_crawled || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Iterations</p>
                  <p className="text-lg font-semibold">{session.progress.iterations || 0}</p>
                </div>
              </div>
            )}

            {session.recent_activity && session.recent_activity.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Recent Activity:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {session.recent_activity.slice().reverse().map((activity, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground flex justify-between">
                      <span>
                        {activity.action === "testing_capability" && activity.capability
                          ? `Testing: ${activity.capability}`
                          : activity.action}
                      </span>
                      <span>{formatTime(activity.elapsed_seconds)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risk Heatmap */}
      {session && Object.keys(session.risk_heatmap).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Live Risk Heatmap</CardTitle>
            <CardDescription>
              Real-time risk assessment for each business capability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(session.risk_heatmap).map(([capability, risk]) => (
                <div
                  key={capability}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <span className="font-medium">{capability}</span>
                  <Badge className={getRiskColor(risk)}>{risk}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Defects */}
      {session && session.defects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected Defects</CardTitle>
            <CardDescription>
              {session.defects_found} defects found during exploration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {session.defects.map((defect, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{defect.title}</h4>
                        <Badge variant={getSeverityColor(defect.severity)}>
                          {defect.severity}
                        </Badge>
                        <Badge variant="outline">{defect.defect_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {defect.description}
                      </p>
                      {defect.page_url && (
                        <p className="text-xs text-muted-foreground mt-2">
                          URL: {defect.page_url}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Proof */}
      {session?.status === "complete" && session.proof && (
        <Card>
          <CardHeader>
            <CardTitle>Completion Proof</CardTitle>
            <CardDescription>
              Nexus's proof that all P1/P2 risks have been addressed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{session.proof}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>How Nexus Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>First 60 seconds:</strong> Rapidly crawls and builds a complete capability map</p>
          <p>• <strong>Continuous:</strong> Maintains a live Risk Heatmap</p>
          <p>• <strong>E2E Testing:</strong> Executes at least 3 full happy + unhappy flows per capability</p>
          <p>• <strong>Validation:</strong> Every defect is validated with reproducible steps + screenshots</p>
          <p>• <strong>Completion:</strong> Only stops when all P1/P2 risks are addressed or proven safe</p>
          <p>• <strong>Parallel:</strong> Aggressively uses parallel tool calls for maximum coverage</p>
        </CardContent>
      </Card>
    </div>
  );
}




