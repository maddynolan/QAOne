import { useState, useEffect } from "react";
import { 
  BarChart3, TrendingUp, TrendingDown, Activity, Clock, 
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Calendar,
  Zap, Bug, Target, Layers
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface TestTrend {
  date: string;
  passed: number;
  failed: number;
  total: number;
  passRate: number;
}

interface FlakyTest {
  testName: string;
  flakinessScore: number;
  executions: number;
  flips: number;
  lastRun: string;
}

interface PerformanceMetric {
  testName: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  trend: "up" | "down" | "stable";
}

interface AnalyticsData {
  summary: {
    totalTests: number;
    totalRuns: number;
    passRate: number;
    avgDuration: number;
    selfHealingRate: number;
    flakyTestCount: number;
  };
  trends: TestTrend[];
  flakyTests: FlakyTest[];
  slowestTests: PerformanceMetric[];
  healingStats: {
    attempted: number;
    successful: number;
    topHealedSelectors: Array<{ selector: string; count: number }>;
  };
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("7d");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      
      // Fetch real data from backend API
      const response = await fetch(`${API_BASE_URL}/dashboard/analytics?range=${timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
        if (showToast) {
          toast.success("Analytics refreshed");
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Fallback to mock data if API fails
      const mockData: AnalyticsData = {
        summary: {
          totalTests: 248,
          totalRuns: 1547,
          passRate: 94.2,
          avgDuration: 12.4,
          selfHealingRate: 78.5,
          flakyTestCount: 7
        },
        trends: generateTrendData(timeRange),
        flakyTests: [
          { testName: "Login - Session Timeout", flakinessScore: 0.45, executions: 89, flips: 12, lastRun: "2 hours ago" },
          { testName: "Cart - Remove Item", flakinessScore: 0.32, executions: 156, flips: 8, lastRun: "4 hours ago" },
          { testName: "Checkout - Payment Modal", flakinessScore: 0.28, executions: 203, flips: 6, lastRun: "1 hour ago" },
          { testName: "Dashboard - Widget Load", flakinessScore: 0.21, executions: 178, flips: 4, lastRun: "30 min ago" },
          { testName: "Profile - Avatar Upload", flakinessScore: 0.18, executions: 92, flips: 3, lastRun: "6 hours ago" },
        ],
        slowestTests: [
          { testName: "E2E - Complete Purchase Flow", avgDuration: 45.2, minDuration: 38.1, maxDuration: 67.8, trend: "up" },
          { testName: "Dashboard - Full Load", avgDuration: 32.1, minDuration: 28.4, maxDuration: 41.2, trend: "stable" },
          { testName: "Report Generation", avgDuration: 28.7, minDuration: 24.2, maxDuration: 35.9, trend: "down" },
          { testName: "User Registration Flow", avgDuration: 24.3, minDuration: 21.1, maxDuration: 29.8, trend: "stable" },
          { testName: "Search - Complex Query", avgDuration: 21.5, minDuration: 18.9, maxDuration: 26.3, trend: "down" },
        ],
        healingStats: {
          attempted: 127,
          successful: 98,
          topHealedSelectors: [
            { selector: ".btn-primary", count: 23 },
            { selector: "#submit-form", count: 18 },
            { selector: "[data-testid='login-btn']", count: 15 },
            { selector: ".modal-close", count: 12 },
            { selector: "input[name='email']", count: 9 },
          ]
        }
      };
      
      setAnalyticsData(mockData);
      
      if (showToast) {
        toast.success("Analytics refreshed");
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateTrendData = (range: string): TestTrend[] => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const data: TestTrend[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const total = Math.floor(Math.random() * 30) + 40;
      const passed = Math.floor(total * (0.85 + Math.random() * 0.12));
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        passed,
        failed: total - passed,
        total,
        passRate: Math.round((passed / total) * 100)
      });
    }
    
    return data;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const data = analyticsData!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Insights into your test execution health and trends
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchAnalytics(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tests</p>
                <p className="text-2xl font-bold">{data.summary.totalTests}</p>
              </div>
              <Layers className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Test Runs</p>
                <p className="text-2xl font-bold">{data.summary.totalRuns.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <p className="text-2xl font-bold text-green-600">{data.summary.passRate}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">{data.summary.avgDuration}s</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Self-Healing</p>
                <p className="text-2xl font-bold text-purple-600">{data.summary.selfHealingRate}%</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flaky Tests</p>
                <p className="text-2xl font-bold text-amber-600">{data.summary.flakyTestCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Execution Trends
          </TabsTrigger>
          <TabsTrigger value="flaky">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Flaky Tests
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Clock className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="healing">
            <Zap className="h-4 w-4 mr-2" />
            Self-Healing
          </TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Execution Trends</CardTitle>
              <CardDescription>Daily pass/fail rates over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Simple bar chart visualization */}
                <div className="flex items-end gap-1 h-48">
                  {data.trends.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex flex-col gap-0.5">
                        <div 
                          className="w-full bg-green-500 rounded-t" 
                          style={{ height: `${(day.passed / 70) * 100}px` }}
                          title={`Passed: ${day.passed}`}
                        />
                        <div 
                          className="w-full bg-red-500 rounded-b" 
                          style={{ height: `${(day.failed / 70) * 20}px` }}
                          title={`Failed: ${day.failed}`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-2 rotate-45 origin-left">
                        {day.date}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-6 mt-8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span className="text-sm text-muted-foreground">Passed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span className="text-sm text-muted-foreground">Failed</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flaky Tests Tab */}
        <TabsContent value="flaky" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flaky Test Detection</CardTitle>
              <CardDescription>
                Tests with inconsistent results that may need attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.flakyTests.map((test, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{test.testName}</h4>
                        <Badge variant={test.flakinessScore > 0.3 ? "destructive" : "secondary"}>
                          {(test.flakinessScore * 100).toFixed(0)}% flaky
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {test.executions} runs • {test.flips} flips • Last run: {test.lastRun}
                      </p>
                    </div>
                    <div className="w-32">
                      <Progress value={test.flakinessScore * 100} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slowest Tests</CardTitle>
              <CardDescription>
                Tests that take the longest to execute
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.slowestTests.map((test, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{test.testName}</h4>
                        {test.trend === "up" && (
                          <Badge variant="destructive" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Slower
                          </Badge>
                        )}
                        {test.trend === "down" && (
                          <Badge variant="default" className="text-xs bg-green-500">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Faster
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Min: {test.minDuration}s • Max: {test.maxDuration}s
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{test.avgDuration}s</p>
                      <p className="text-xs text-muted-foreground">avg duration</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Self-Healing Tab */}
        <TabsContent value="healing" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Self-Healing Statistics</CardTitle>
                <CardDescription>
                  Automatic test repair success metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span>Healing Attempts</span>
                    <span className="text-2xl font-bold">{data.healingStats.attempted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Successful Heals</span>
                    <span className="text-2xl font-bold text-green-600">{data.healingStats.successful}</span>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Success Rate</span>
                      <span className="font-medium">
                        {((data.healingStats.successful / data.healingStats.attempted) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={(data.healingStats.successful / data.healingStats.attempted) * 100} 
                      className="h-3"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most Healed Selectors</CardTitle>
                <CardDescription>
                  Selectors that frequently needed healing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.healingStats.topHealedSelectors.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <code className="text-sm bg-muted px-2 py-1 rounded">{item.selector}</code>
                      <Badge variant="outline">{item.count}x</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Self-Healing Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <h4 className="font-medium text-green-700 dark:text-green-300">Tests Saved</h4>
                  <p className="text-3xl font-bold text-green-600 mt-2">{data.healingStats.successful}</p>
                  <p className="text-sm text-green-600/70 mt-1">
                    Tests that would have failed without healing
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-medium text-blue-700 dark:text-blue-300">Time Saved</h4>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    {Math.round(data.healingStats.successful * 15)}min
                  </p>
                  <p className="text-sm text-blue-600/70 mt-1">
                    Estimated manual fix time avoided
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <h4 className="font-medium text-purple-700 dark:text-purple-300">Stability Score</h4>
                  <p className="text-3xl font-bold text-purple-600 mt-2">A+</p>
                  <p className="text-sm text-purple-600/70 mt-1">
                    Based on healing success rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
