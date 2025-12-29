import { BarChart3, DollarSign, TrendingUp, Users, Activity, Clock, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { telemetryService, UsageMetrics, CostBreakdown, UsageTrend } from "@/lib/telemetry-service";
import { toast } from "sonner";

export default function Telemetry() {
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [usageTrends, setUsageTrends] = useState<UsageTrend[]>([]);
  const [topUsers, setTopUsers] = useState<Array<{ userId: string; events: number; cost: number }>>([]);
  const [topProjects, setTopProjects] = useState<Array<{ projectId: string; events: number; cost: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadTelemetryData();
  }, [timeRange]);

  const loadTelemetryData = async () => {
    setIsLoading(true);
    try {
      const orgId = "550e8400-e29b-41d4-a716-446655440000"; // Mock org ID
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const [metrics, breakdown, trends, users, projects] = await Promise.all([
        telemetryService.getUsageMetrics(orgId, startDate),
        telemetryService.getCostBreakdown(orgId, startDate),
        telemetryService.getUsageTrends(orgId, days),
        telemetryService.getTopUsers(orgId, 10),
        telemetryService.getTopProjects(orgId, 10)
      ]);
      
      setUsageMetrics(metrics);
      setCostBreakdown(breakdown);
      setUsageTrends(trends);
      setTopUsers(users);
      setTopProjects(projects);
    } catch (error) {
      toast.error(`Failed to load telemetry data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'ai_generation':
        return <BarChart3 className="h-4 w-4" />;
      case 'ai_triage':
        return <Activity className="h-4 w-4" />;
      case 'test_execution':
        return <CheckCircle className="h-4 w-4" />;
      case 'jira_integration':
        return <Users className="h-4 w-4" />;
      case 'self_healing':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'ai_generation':
        return 'text-blue-600';
      case 'ai_triage':
        return 'text-purple-600';
      case 'test_execution':
        return 'text-green-600';
      case 'jira_integration':
        return 'text-orange-600';
      case 'self_healing':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(cost);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatDuration = (duration: number) => {
    if (duration >= 3600000) {
      return `${(duration / 3600000).toFixed(1)}h`;
    } else if (duration >= 60000) {
      return `${(duration / 60000).toFixed(1)}m`;
    } else if (duration >= 1000) {
      return `${(duration / 1000).toFixed(1)}s`;
    }
    return `${duration}ms`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Usage & Cost Telemetry</h1>
          <p className="text-muted-foreground mt-1">Loading telemetry data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Usage & Cost Telemetry</h1>
          <p className="text-muted-foreground mt-1">Monitor usage patterns and costs across your organization</p>
        </div>
        <div className="flex gap-2">
          <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
            <TabsList>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
              <TabsTrigger value="90d">90 Days</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={loadTelemetryData} variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{usageMetrics?.totalEvents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">{formatCost(usageMetrics?.totalCost || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">{formatTokens(usageMetrics?.totalTokens || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Duration</p>
                <p className="text-2xl font-bold">{formatDuration(usageMetrics?.totalDuration || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
          <TabsTrigger value="users">Top Users</TabsTrigger>
          <TabsTrigger value="projects">Top Projects</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Success Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Success Rate</span>
                    <span>{Math.round(usageMetrics?.successRate || 0)}%</span>
                  </div>
                  <Progress value={usageMetrics?.successRate || 0} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Error Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Error Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Error Rate</span>
                    <span>{Math.round(usageMetrics?.errorRate || 0)}%</span>
                  </div>
                  <Progress value={usageMetrics?.errorRate || 0} className="h-3" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Events by Type */}
          <Card>
            <CardHeader>
              <CardTitle>Events by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {usageMetrics && Object.keys(usageMetrics.eventsByType).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(usageMetrics.eventsByType).map(([eventType, count]) => (
                    <div key={eventType} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={getEventTypeColor(eventType)}>
                          {getEventTypeIcon(eventType)}
                        </span>
                        <span className="font-medium capitalize">
                          {eventType.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {count} events
                        </span>
                        <span className="text-sm font-medium">
                          {formatCost(usageMetrics.costByType[eventType] || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Events Found</h3>
                  <p className="text-muted-foreground">
                    Start using the platform to see telemetry data
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Breakdown */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {costBreakdown ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCost(costBreakdown.aiGeneration)}
                      </div>
                      <div className="text-muted-foreground">AI Generation</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCost(costBreakdown.aiTriage)}
                      </div>
                      <div className="text-muted-foreground">AI Triage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCost(costBreakdown.testExecution)}
                      </div>
                      <div className="text-muted-foreground">Test Execution</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCost(costBreakdown.jiraIntegration)}
                      </div>
                      <div className="text-muted-foreground">Jira Integration</div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total Cost</span>
                      <span className="text-2xl font-bold">{formatCost(costBreakdown.total)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Cost Data</h3>
                  <p className="text-muted-foreground">
                    No cost data available for the selected time range
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Trends */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usageTrends.length > 0 ? (
                <div className="space-y-4">
                  {usageTrends.slice(-10).map((trend, index) => (
                    <div key={trend.date} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">{trend.date}</h4>
                        <Badge variant="outline">{trend.events} events</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {formatCost(trend.cost)}
                          </div>
                          <div className="text-muted-foreground">Cost</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {formatTokens(trend.tokens)}
                          </div>
                          <div className="text-muted-foreground">Tokens</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600">
                            {formatDuration(trend.duration)}
                          </div>
                          <div className="text-muted-foreground">Duration</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Trend Data</h3>
                  <p className="text-muted-foreground">
                    No usage trend data available for the selected time range
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Users */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topUsers.length > 0 ? (
                <div className="space-y-4">
                  {topUsers.map((user, index) => (
                    <div key={user.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{user.userId}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {user.events} events
                        </span>
                        <span className="text-sm font-medium">
                          {formatCost(user.cost)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No User Data</h3>
                  <p className="text-muted-foreground">
                    No user activity data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Projects */}
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProjects.length > 0 ? (
                <div className="space-y-4">
                  {topProjects.map((project, index) => (
                    <div key={project.projectId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{project.projectId}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {project.events} events
                        </span>
                        <span className="text-sm font-medium">
                          {formatCost(project.cost)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Project Data</h3>
                  <p className="text-muted-foreground">
                    No project activity data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


