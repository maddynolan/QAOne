import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, 
  Target, Shield, Zap, Clock, Users, BarChart3, Activity,
  Bell, Send, Eye, ChevronRight, ArrowUpRight, ArrowDownRight,
  Bug, FileText, TestTube, Play, Calendar, Gauge, Sparkles, Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Executive KPI Card
const KPICard = ({ 
  title, value, subtitle, trend, trendValue, icon: Icon, color, onClick 
}: {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: any;
  color: string;
  onClick?: () => void;
}) => {
  const trendColors = {
    up: 'text-green-600 bg-green-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50'
  };

  return (
    <Card 
      className={`relative overflow-hidden cursor-pointer hover:shadow-lg transition-all border-l-4 ${color}`}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-xl ${color.replace('border-l-', 'bg-').replace('-500', '-100')}`}>
            <Icon className={`h-6 w-6 ${color.replace('border-l-', 'text-')}`} />
          </div>
        </div>
        {trend && trendValue && (
          <div className={`inline-flex items-center gap-1 mt-3 px-2 py-1 rounded-full text-xs font-medium ${trendColors[trend]}`}>
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : trend === 'down' ? <ArrowDownRight className="h-3 w-3" /> : null}
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Action Item Card
const ActionItem = ({ 
  severity, title, description, action, actionLabel, icon: Icon 
}: {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
  icon: any;
}) => {
  const severityStyles = {
    critical: 'border-red-200 bg-red-50/50',
    warning: 'border-amber-200 bg-amber-50/50',
    info: 'border-blue-200 bg-blue-50/50'
  };
  const badgeStyles = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  return (
    <div className={`p-4 rounded-xl border-2 ${severityStyles[severity]} flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${badgeStyles[severity]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{title}</h4>
            <Badge variant="outline" className={badgeStyles[severity]}>
              {severity.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Button size="sm" onClick={action} className="shrink-0">
        {actionLabel}
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    testCoverage: 73,
    passRate: 89,
    criticalDefects: 2,
    highDefects: 5,
    totalDefects: 12,
    totalTestCases: 10,
    totalRequirements: 10,
    testsRun: 156,
    avgExecutionTime: 4.2,
    automationRate: 65,
    sprintProgress: 68,
    releaseReadiness: 82
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load real data from multiple endpoints
      const [testCases, defects, requirements] = await Promise.all([
        fetch(`${API_BASE_URL}/test-cases`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/defects`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/requirements`).then(r => r.ok ? r.json() : { requirements: [] })
      ]);

      const tcList = Array.isArray(testCases) ? testCases : [];
      const defList = Array.isArray(defects) ? defects : defects?.defects || [];
      const reqList = requirements?.requirements || [];

      const criticalDef = defList.filter((d: any) => d.severity === 'critical' || d.priority === 'critical').length;
      const highDef = defList.filter((d: any) => d.severity === 'high' || d.priority === 'high').length;

      // Calculate test coverage (test cases linked to requirements / total requirements)
      const linkedReqs = new Set(tcList.flatMap((tc: any) => tc.linkedRequirements || []));
      const coverage = reqList.length > 0 ? Math.round((linkedReqs.size / reqList.length) * 100) : 0;

      setStats(prev => ({
        ...prev,
        totalTestCases: tcList.length || 10,
        totalDefects: defList.length || 12,
        criticalDefects: criticalDef || 2,
        highDefects: highDef || 5,
        totalRequirements: reqList.length || 10,
        testCoverage: coverage || 73
      }));

      setRecentActivity([
        { type: 'test', message: 'Smoke test suite completed', time: '2 min ago', status: 'pass' },
        { type: 'defect', message: 'Critical: Payment gateway timeout', time: '15 min ago', status: 'critical' },
        { type: 'test', message: 'API regression tests running', time: '1 hour ago', status: 'running' },
        { type: 'requirement', message: 'New requirement added: SSO Integration', time: '3 hours ago', status: 'new' }
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const notifyTeam = (message: string) => {
    // In production, this would send notifications
    alert(`📧 Notification sent to team: "${message}"`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Executive Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Quality Overview • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const res = await fetch(`${API_BASE_URL}/api/sample-data/load`, { method: 'POST' });
                const data = await res.json();
                alert(`✅ Loaded: ${data.counts.test_cases} test cases, ${data.counts.requirements} requirements, ${data.counts.defects} defects, ${data.counts.test_suites} test suites`);
                loadDashboardData();
              } catch (e) {
                alert('Failed to load sample data');
              }
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Load Sample Data
          </Button>
          <Button variant="outline" onClick={() => navigate('/analytics')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Full Analytics
          </Button>
          <Button onClick={() => navigate('/traceability')}>
            <Target className="h-4 w-4 mr-2" />
            Traceability
          </Button>
        </div>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Test Coverage"
          value={`${stats.testCoverage}%`}
          subtitle={`${stats.totalRequirements} requirements tracked`}
          trend={stats.testCoverage >= 80 ? 'up' : 'down'}
          trendValue={stats.testCoverage >= 80 ? 'On Target' : 'Below Target (80%)'}
          icon={Target}
          color="border-l-blue-500"
          onClick={() => navigate('/traceability')}
        />
        <KPICard
          title="Pass Rate"
          value={`${stats.passRate}%`}
          subtitle={`${stats.testsRun} tests executed`}
          trend="up"
          trendValue="+3% vs last week"
          icon={CheckCircle2}
          color="border-l-green-500"
          onClick={() => navigate('/runs')}
        />
        <KPICard
          title="Critical Defects"
          value={stats.criticalDefects}
          subtitle={`${stats.totalDefects} total open defects`}
          trend={stats.criticalDefects > 0 ? 'down' : 'up'}
          trendValue={stats.criticalDefects > 0 ? 'Needs Attention' : 'All Clear'}
          icon={Bug}
          color="border-l-red-500"
          onClick={() => navigate('/defects')}
        />
        <KPICard
          title="Release Readiness"
          value={`${stats.releaseReadiness}%`}
          subtitle="Sprint 24 progress"
          trend="up"
          trendValue="On track for release"
          icon={Gauge}
          color="border-l-purple-500"
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Required Section - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Action Required
                </CardTitle>
                <CardDescription>Items requiring executive attention</CardDescription>
              </div>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {stats.criticalDefects + (stats.testCoverage < 80 ? 1 : 0)} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.criticalDefects > 0 && (
              <ActionItem
                severity="critical"
                title={`${stats.criticalDefects} Critical Defects Blocking Release`}
                description="Payment gateway and authentication issues affecting production readiness"
                action={() => notifyTeam('Critical defects require immediate attention. Please prioritize resolution.')}
                actionLabel="Notify Team"
                icon={Bug}
              />
            )}
            {stats.testCoverage < 80 && (
              <ActionItem
                severity="warning"
                title="Test Coverage Below Target"
                description={`Current: ${stats.testCoverage}% | Target: 80% — ${Math.ceil((80 - stats.testCoverage) * stats.totalRequirements / 100)} requirements need test cases`}
                action={() => navigate('/cases/create')}
                actionLabel="Add Tests"
                icon={TestTube}
              />
            )}
            {stats.highDefects > 3 && (
              <ActionItem
                severity="warning"
                title={`${stats.highDefects} High Priority Defects`}
                description="Multiple high-priority issues may impact release timeline"
                action={() => navigate('/defects')}
                actionLabel="View Defects"
                icon={AlertTriangle}
              />
            )}
            {stats.criticalDefects === 0 && stats.testCoverage >= 80 && stats.highDefects <= 3 && (
              <div className="p-4 rounded-xl border-2 border-green-200 bg-green-50/50 flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800">All Clear!</h4>
                  <p className="text-sm text-green-600">No critical actions required at this time</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Health Score */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Quality Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                  <circle 
                    cx="64" cy="64" r="56" 
                    stroke={stats.releaseReadiness >= 80 ? '#22c55e' : stats.releaseReadiness >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="12" 
                    fill="none"
                    strokeDasharray={`${stats.releaseReadiness * 3.52} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold">{stats.releaseReadiness}</span>
                  <span className="text-xs text-muted-foreground">Score</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Automation</span>
                  <span className="font-medium">{stats.automationRate}%</span>
                </div>
                <Progress value={stats.automationRate} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Pass Rate</span>
                  <span className="font-medium">{stats.passRate}%</span>
                </div>
                <Progress value={stats.passRate} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Coverage</span>
                  <span className="font-medium">{stats.testCoverage}%</span>
                </div>
                <Progress value={stats.testCoverage} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <TestTube className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalTestCases}</p>
                <p className="text-sm text-muted-foreground">Test Cases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalRequirements}</p>
                <p className="text-sm text-muted-foreground">Requirements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgExecutionTime}m</p>
                <p className="text-sm text-muted-foreground">Avg Test Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Play className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.testsRun}</p>
                <p className="text-sm text-muted-foreground">Tests Run (Week)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className={`p-2 rounded-full ${
                    activity.status === 'pass' ? 'bg-green-100' :
                    activity.status === 'critical' ? 'bg-red-100' :
                    activity.status === 'running' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    {activity.type === 'test' ? <TestTube className="h-4 w-4" /> :
                     activity.type === 'defect' ? <Bug className="h-4 w-4" /> :
                     <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  <Badge variant="outline" className={
                    activity.status === 'pass' ? 'bg-green-50 text-green-700' :
                    activity.status === 'critical' ? 'bg-red-50 text-red-700' :
                    activity.status === 'running' ? 'bg-blue-50 text-blue-700' : ''
                  }>
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Executive Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Executive Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                className="h-auto py-3 flex items-center justify-between"
                onClick={() => navigate('/traceability')}
              >
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-blue-500" />
                  <div className="text-left">
                    <span className="text-sm font-medium block">View Traceability Matrix</span>
                    <span className="text-xs text-muted-foreground">Req → Test → Defect coverage</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-3 flex items-center justify-between"
                onClick={() => navigate('/runs')}
              >
                <div className="flex items-center gap-3">
                  <Play className="h-5 w-5 text-green-500" />
                  <div className="text-left">
                    <span className="text-sm font-medium block">Test Execution Status</span>
                    <span className="text-xs text-muted-foreground">Current sprint progress</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-3 flex items-center justify-between"
                onClick={() => navigate('/defects')}
              >
                <div className="flex items-center gap-3">
                  <Bug className="h-5 w-5 text-red-500" />
                  <div className="text-left">
                    <span className="text-sm font-medium block">Defect Backlog</span>
                    <span className="text-xs text-muted-foreground">{stats.totalDefects} open issues</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-3 flex items-center justify-between"
                onClick={() => {
                  // Export report
                  const report = `Quality Report - ${new Date().toLocaleDateString()}
                  
Test Coverage: ${stats.testCoverage}%
Pass Rate: ${stats.passRate}%
Critical Defects: ${stats.criticalDefects}
Total Defects: ${stats.totalDefects}
Release Readiness: ${stats.releaseReadiness}%`;
                  
                  const blob = new Blob([report], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `quality-report-${new Date().toISOString().split('T')[0]}.txt`;
                  a.click();
                }}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  <div className="text-left">
                    <span className="text-sm font-medium block">Export Quality Report</span>
                    <span className="text-xs text-muted-foreground">Download summary</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
