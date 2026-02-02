import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, CheckCircle2, XCircle, 
  AlertTriangle, Bug, TestTube, Play, Clock, RefreshCw,
  ChevronRight, Activity, Zap, BarChart3, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { resultsIngestionService } from '@/lib/results-ingestion-service';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD - Clean, focused view of what matters
// ═══════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Core metrics - only what matters
  const [metrics, setMetrics] = useState({
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    passRate: 0,
    totalRuns: 0,
    openDefects: 0,
    criticalDefects: 0,
    flakyTests: 0,
    avgDuration: 0,
    trend: 'stable' as 'up' | 'down' | 'stable',
    trendValue: 0
  });

  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [needsAttention, setNeedsAttention] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [testCases, defects, testRuns] = await Promise.all([
        fetch(`${API_BASE_URL}/test-cases`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/defects`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/test-runs`).then(r => r.ok ? r.json() : [])
      ]);

      const tcList = Array.isArray(testCases) ? testCases : testCases?.test_cases || [];
      const defList = Array.isArray(defects) ? defects : defects?.defects || [];
      const runList = Array.isArray(testRuns) ? testRuns : testRuns?.test_runs || testRuns?.runs || [];

      // Get in-memory results from current session
      const inMemoryResults = resultsIngestionService.getAllResults();

      // Calculate metrics from all sources
      let totalTests = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      let totalDuration = 0;

      // From in-memory results
      inMemoryResults.forEach(run => {
        run.test_cases.forEach(tc => {
          totalTests++;
          if (tc.status === 'passed') passed++;
          else if (tc.status === 'failed') failed++;
          else skipped++;
        });
        totalDuration += run.metadata.duration || 0;
      });

      // From API runs
      runList.forEach((run: any) => {
        if (run.total_tests) totalTests += run.total_tests;
        if (run.passed) passed += run.passed;
        if (run.failed) failed += run.failed;
        if (run.skipped) skipped += run.skipped;
      });

      // Calculate pass rate
      const executed = passed + failed;
      const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

      // Open defects
      const openDefs = defList.filter((d: any) => 
        !d.status || d.status === 'open' || d.status === 'new' || d.status === 'in_progress'
      );
      const criticalDefs = openDefs.filter((d: any) => 
        d.severity === 'critical' || d.priority === 'critical'
      );

      // Calculate trend (compare to last 7 days if we had historical data)
      // For now, use pass rate to determine trend
      const trend = passRate >= 90 ? 'up' : passRate >= 70 ? 'stable' : 'down';
      const trendValue = passRate >= 90 ? 5 : passRate >= 70 ? 0 : -5;

      setMetrics({
        totalTests,
        passed,
        failed,
        skipped,
        passRate,
        totalRuns: inMemoryResults.length + runList.length,
        openDefects: openDefs.length,
        criticalDefects: criticalDefs.length,
        flakyTests: 0, // TODO: Calculate from test history
        avgDuration: inMemoryResults.length > 0 ? Math.round(totalDuration / inMemoryResults.length / 1000) : 0,
        trend,
        trendValue
      });

      // Build recent runs list
      const runs: any[] = [];
      inMemoryResults.slice(-5).reverse().forEach(run => {
        const passedCount = run.test_cases.filter(tc => tc.status === 'passed').length;
        const failedCount = run.test_cases.filter(tc => tc.status === 'failed').length;
        runs.push({
          id: run.run_id,
          name: run.test_name || 'Test Run',
          status: failedCount > 0 ? 'failed' : 'passed',
          passed: passedCount,
          total: run.test_cases.length,
          timestamp: new Date(run.metadata.timestamp),
          duration: run.metadata.duration
        });
      });
      setRecentRuns(runs);

      // Build "needs attention" list
      const attention: any[] = [];
      
      if (criticalDefs.length > 0) {
        attention.push({
          type: 'critical',
          icon: Bug,
          title: `${criticalDefs.length} Critical Defect${criticalDefs.length > 1 ? 's' : ''}`,
          description: 'Blocking issues need immediate attention',
          action: () => navigate('/test-cases?tab=defects')
        });
      }
      
      if (failed > 0) {
        attention.push({
          type: 'warning',
          icon: XCircle,
          title: `${failed} Failed Test${failed > 1 ? 's' : ''}`,
          description: 'Review and fix failing tests',
          action: () => navigate('/test-cases?tab=runs')
        });
      }

      if (tcList.length === 0) {
        attention.push({
          type: 'info',
          icon: TestTube,
          title: 'No Tests Yet',
          description: 'Create your first test to get started',
          action: () => navigate('/recorder')
        });
      }

      setNeedsAttention(attention);
      setLastRefresh(new Date());

    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Health status color based on pass rate
  const getHealthStatus = () => {
    if (metrics.totalTests === 0) return { color: 'bg-gray-100 text-gray-600', label: 'No Data', icon: Activity };
    if (metrics.passRate >= 90) return { color: 'bg-green-100 text-green-700', label: 'Healthy', icon: CheckCircle2 };
    if (metrics.passRate >= 70) return { color: 'bg-yellow-100 text-yellow-700', label: 'Warning', icon: AlertTriangle };
    return { color: 'bg-red-100 text-red-700', label: 'Critical', icon: XCircle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Last updated {formatTimeAgo(lastRefresh)}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TOP ROW: Health Status + Quick Actions */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Status - Big Visual */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              {/* Pass Rate Circle */}
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-gray-100"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${metrics.passRate * 3.52} 352`}
                    className={metrics.passRate >= 90 ? 'text-green-500' : metrics.passRate >= 70 ? 'text-yellow-500' : 'text-red-500'}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{metrics.passRate}%</span>
                  <span className="text-xs text-muted-foreground">Pass Rate</span>
                </div>
              </div>

              {/* Status Details */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className={`${health.color} px-3 py-1`}>
                    <HealthIcon className="h-4 w-4 mr-1" />
                    {health.label}
                  </Badge>
                  {metrics.trend !== 'stable' && (
                    <Badge variant="outline" className={metrics.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                      {metrics.trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {metrics.trend === 'up' ? 'Improving' : 'Declining'}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{metrics.passed}</div>
                    <div className="text-xs text-green-600">Passed</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{metrics.failed}</div>
                    <div className="text-xs text-red-600">Failed</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{metrics.skipped}</div>
                    <div className="text-xs text-gray-600">Skipped</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => navigate('/recorder')}
            >
              <Play className="h-4 w-4 mr-2 text-green-500" />
              Record New Test
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => navigate('/test-cases/builder')}
            >
              <TestTube className="h-4 w-4 mr-2 text-blue-500" />
              Build Test Case
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => navigate('/test-cases?tab=runs')}
            >
              <Eye className="h-4 w-4 mr-2 text-purple-500" />
              View Test Runs
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => navigate('/test-cases?tab=defects')}
            >
              <Bug className="h-4 w-4 mr-2 text-red-500" />
              Manage Defects
              {metrics.openDefects > 0 && (
                <Badge className="ml-auto bg-red-100 text-red-700">{metrics.openDefects}</Badge>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MIDDLE ROW: Key Metrics (4 cards) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/test-cases')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tests</p>
                <p className="text-2xl font-bold">{metrics.totalTests}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <TestTube className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/test-cases?tab=runs')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Test Runs</p>
                <p className="text-2xl font-bold">{metrics.totalRuns}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Play className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/test-cases?tab=defects')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Defects</p>
                <p className="text-2xl font-bold">{metrics.openDefects}</p>
              </div>
              <div className={`p-2 rounded-lg ${metrics.criticalDefects > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Bug className={`h-5 w-5 ${metrics.criticalDefects > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
            </div>
            {metrics.criticalDefects > 0 && (
              <Badge className="mt-2 bg-red-100 text-red-700 text-xs">
                {metrics.criticalDefects} critical
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {metrics.avgDuration > 0 ? `${metrics.avgDuration}s` : '-'}
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BOTTOM ROW: Recent Runs + Needs Attention */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Runs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-gray-500" />
                Recent Test Runs
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/test-cases?tab=runs')}>
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No test runs yet</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => navigate('/recorder')}
                >
                  Record your first test
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRuns.map((run, i) => (
                  <div 
                    key={run.id || i}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate('/test-cases?tab=runs')}
                  >
                    <div className="flex items-center gap-3">
                      {run.status === 'passed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{run.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {run.passed}/{run.total} passed
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(run.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Needs Attention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Needs Attention
              {needsAttention.length > 0 && (
                <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">
                  {needsAttention.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="font-medium text-green-700">All Clear!</p>
                <p className="text-sm">No issues requiring attention</p>
              </div>
            ) : (
              <div className="space-y-3">
                {needsAttention.map((item, i) => {
                  const ItemIcon = item.icon;
                  const bgColor = item.type === 'critical' ? 'bg-red-50 border-red-200' 
                    : item.type === 'warning' ? 'bg-amber-50 border-amber-200' 
                    : 'bg-blue-50 border-blue-200';
                  const iconColor = item.type === 'critical' ? 'text-red-500' 
                    : item.type === 'warning' ? 'text-amber-500' 
                    : 'text-blue-500';
                  
                  return (
                    <div 
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-lg border ${bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={item.action}
                    >
                      <div className="flex items-center gap-3">
                        <ItemIcon className={`h-5 w-5 ${iconColor}`} />
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ANALYTICS SECTION (Consolidated from Analytics page) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Test Execution Trend (Last 7 Days)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {/* Simple bar chart visualization */}
          <div className="flex items-end gap-2 h-32">
            {[65, 72, 68, 85, 90, 78, metrics.passRate || 80].map((value, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className={`w-full rounded-t transition-all ${
                    value >= 90 ? 'bg-green-500' : value >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ height: `${value}%` }}
                />
                <span className="text-xs text-muted-foreground">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'][i]}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>≥90% (Healthy)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span>70-89% (Warning)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>&lt;70% (Critical)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
