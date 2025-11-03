import { BarChart3, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { analyticsService, AnalyticsData } from "@/lib/analytics-service";
import { resultsIngestionService } from "@/lib/results-ingestion-service";
import { toast } from "sonner";

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const orgId = "550e8400-e29b-41d4-a716-446655440000"; // Mock org ID
      const data = await analyticsService.getOrgAnalytics(orgId);
      setAnalytics(data);
    } catch (error) {
      toast.error(`Failed to load analytics: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) {
      return 'text-green-600';
    } else if (current < previous) {
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Loading analytics data...</p>
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

  if (!analytics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">No analytics data available</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p className="text-muted-foreground text-center mb-4">
              Run some tests to see analytics data here
            </p>
            <Button onClick={loadAnalytics}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Refresh Analytics
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Organization-wide test analytics and insights</p>
        </div>
        <Button onClick={loadAnalytics} variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Runs</p>
                <p className="text-2xl font-bold">{analytics.totalRuns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{Math.round(analytics.successRate)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">{Math.round(analytics.averageDuration / 1000)}s</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Tests</p>
                <p className="text-2xl font-bold">{analytics.totalTests}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Results Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{analytics.passedTests}</div>
              <div className="text-muted-foreground">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{analytics.failedTests}</div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{analytics.skippedTests}</div>
              <div className="text-muted-foreground">Skipped</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Success Rate</span>
              <span>{Math.round(analytics.successRate)}%</span>
            </div>
            <Progress value={analytics.successRate} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Test Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
            
            <TabsContent value={timeRange} className="space-y-4">
              {analytics.trends[timeRange].length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Trend Data</h3>
                  <p className="text-muted-foreground">
                    Run more tests to see trend data
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analytics.trends[timeRange].slice(-10).map((trend, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">
                          {timeRange === 'daily' ? trend.date : 
                           timeRange === 'weekly' ? trend.week : trend.month}
                        </h4>
                        <Badge variant="outline">{trend.runs} runs</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{trend.tests}</div>
                          <div className="text-muted-foreground">Tests</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{trend.passed}</div>
                          <div className="text-muted-foreground">Passed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-600">{trend.failed}</div>
                          <div className="text-muted-foreground">Failed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-yellow-600">{trend.skipped}</div>
                          <div className="text-muted-foreground">Skipped</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Top Failing Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Top Failing Tests</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topFailingTests.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Failing Tests</h3>
              <p className="text-muted-foreground">
                Great job! All tests are passing
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {analytics.topFailingTests.map((test, index) => (
                <div key={test.testId} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">#{index + 1}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {test.failureCount} failures
                        </span>
                      </div>
                      <h4 className="font-semibold">{test.testName}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Last failure: {new Date(test.lastFailure).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <XCircle className="h-3 w-3 mr-1" />
                      Investigate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Project Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.projectStats.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Project Data</h3>
              <p className="text-muted-foreground">
                Create projects and run tests to see project statistics
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {analytics.projectStats.map((project) => (
                <div key={project.projectId} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold">{project.projectName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {project.runs} runs • {project.tests} tests
                      </p>
                    </div>
                    <Badge variant="outline">
                      {Math.round(project.successRate)}% success
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span>{Math.round(project.successRate)}%</span>
                    </div>
                    <Progress value={project.successRate} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Avg Duration:</span>
                      <span className="ml-2 font-medium">
                        {Math.round(project.averageDuration / 1000)}s
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Runs:</span>
                      <span className="ml-2 font-medium">{project.runs}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


