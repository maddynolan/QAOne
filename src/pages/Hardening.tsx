import { Bug, TestTube, Play, CheckCircle, XCircle, AlertTriangle, Clock, Users, Trophy, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { hardeningService, BugReport, TestCase, TestExecution, BugBashSession } from "@/lib/hardening-service";
import { toast } from "sonner";

export default function Hardening() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testExecutions, setTestExecutions] = useState<TestExecution[]>([]);
  const [bugBashSessions, setBugBashSessions] = useState<BugBashSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allBugs = hardeningService.getAllBugReports();
    const allTestCases = hardeningService.getAllTestCases();
    const allExecutions = hardeningService.getAllTestExecutions();
    const allSessions = hardeningService.getAllBugBashSessions();
    
    setBugReports(allBugs);
    setTestCases(allTestCases);
    setTestExecutions(allExecutions);
    setBugBashSessions(allSessions);
  };

  const executeTestCase = async (testCaseId: string) => {
    setIsLoading(true);
    try {
      const executionId = await hardeningService.executeTestCase(
        testCaseId,
        'current-user@company.com',
        'Staging'
      );
      
      const execution = hardeningService.getTestExecution(executionId);
      if (execution) {
        setTestExecutions(prev => [execution, ...prev]);
        toast.success("Test case executed successfully!");
      }
    } catch (error) {
      toast.error(`Failed to execute test case: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startBugBash = async () => {
    setIsLoading(true);
    try {
      const sessionId = await hardeningService.createBugBashSession({
        name: `Bug Bash ${new Date().toLocaleString()}`,
        description: 'Comprehensive bug hunting session',
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        status: 'planned',
        participants: ['user1@company.com', 'user2@company.com', 'user3@company.com'],
        testCases: testCases.map(tc => tc.id),
        rewards: {
          type: 'points',
          value: 100,
          description: 'Points for each bug found'
        },
        rules: [
          'Report bugs with detailed steps to reproduce',
          'Include screenshots and error messages',
          'Test on multiple browsers and devices',
          'Focus on critical and high severity issues'
        ]
      });
      
      const session = hardeningService.getBugBashSession(sessionId);
      if (session) {
        setBugBashSessions(prev => [session, ...prev]);
        toast.success("Bug bash session created successfully!");
      }
    } catch (error) {
      toast.error(`Failed to create bug bash session: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'completed':
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'open':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'pending':
      case 'ready':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
      case 'completed':
      case 'resolved':
        return 'default';
      case 'failed':
      case 'open':
        return 'destructive';
      case 'running':
      case 'in_progress':
        return 'secondary';
      case 'pending':
      case 'ready':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatDuration = (duration: number) => {
    if (duration >= 60000) {
      return `${Math.round(duration / 60000)}m ${Math.round((duration % 60000) / 1000)}s`;
    } else if (duration >= 1000) {
      return `${Math.round(duration / 1000)}s`;
    }
    return `${duration}ms`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Hardening & Bug Bash</h1>
          <p className="text-muted-foreground mt-1">Comprehensive testing and bug hunting platform</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={startBugBash}
            disabled={isLoading}
            variant="outline"
          >
            <Target className="h-4 w-4 mr-2" />
            Start Bug Bash
          </Button>
          <Button 
            onClick={() => executeTestCase(testCases[0]?.id)}
            disabled={isLoading || testCases.length === 0}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Execute Test
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Bug className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Bugs</p>
                <p className="text-2xl font-bold">{bugReports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TestTube className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Test Cases</p>
                <p className="text-2xl font-bold">{testCases.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Play className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Executions</p>
                <p className="text-2xl font-bold">{testExecutions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Bug Bash Sessions</p>
                <p className="text-2xl font-bold">{bugBashSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
          <TabsTrigger value="tests">Test Cases</TabsTrigger>
          <TabsTrigger value="executions">Test Executions</TabsTrigger>
          <TabsTrigger value="bugbash">Bug Bash</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bug Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Bug Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {bugReports.filter(b => b.severity === 'critical').length}
                    </div>
                    <div className="text-muted-foreground">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {bugReports.filter(b => b.severity === 'high').length}
                    </div>
                    <div className="text-muted-foreground">High</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {bugReports.filter(b => b.severity === 'medium').length}
                    </div>
                    <div className="text-muted-foreground">Medium</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {bugReports.filter(b => b.severity === 'low').length}
                    </div>
                    <div className="text-muted-foreground">Low</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Test Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ready Tests</span>
                    <span>{testCases.filter(tc => tc.status === 'ready').length}</span>
                  </div>
                  <Progress 
                    value={(testCases.filter(tc => tc.status === 'ready').length / testCases.length) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Average Pass Rate: {testCases.length > 0 
                    ? `${Math.round(testCases.reduce((sum, tc) => sum + tc.passRate, 0) / testCases.length)}%`
                    : '0%'
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {testExecutions.slice(0, 5).map((execution) => (
                  <div key={execution.id} className="flex items-center justify-between text-sm">
                    <span>Test execution {execution.id}</span>
                    <Badge variant={getStatusColor(execution.status)}>
                      {getStatusIcon(execution.status)}
                      <span className="ml-1">{execution.status}</span>
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bug Reports */}
        <TabsContent value="bugs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Bug Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bugReports.length === 0 ? (
                <div className="text-center py-8">
                  <Bug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Bug Reports</h3>
                  <p className="text-muted-foreground">
                    Start testing to find and report bugs
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bugReports.map((bug) => (
                    <div key={bug.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getSeverityColor(bug.severity)}>
                              {getSeverityIcon(bug.severity)}
                              <span className="ml-1">{bug.severity}</span>
                            </Badge>
                            <Badge variant={getStatusColor(bug.status)}>
                              {getStatusIcon(bug.status)}
                              <span className="ml-1">{bug.status}</span>
                            </Badge>
                            <Badge variant="outline">{bug.category}</Badge>
                          </div>
                          <h4 className="font-semibold">{bug.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {bug.description}
                          </p>
                          
                          <div className="mt-2 text-xs text-muted-foreground">
                            Reported by: {bug.reporter} • {bug.createdAt.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Cases */}
        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testCases.length === 0 ? (
                <div className="text-center py-8">
                  <TestTube className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Test Cases</h3>
                  <p className="text-muted-foreground">
                    Create test cases to start testing
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {testCases.map((testCase) => (
                    <div key={testCase.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getStatusColor(testCase.status)}>
                              {getStatusIcon(testCase.status)}
                              <span className="ml-1">{testCase.status}</span>
                            </Badge>
                            <Badge variant="outline">{testCase.category}</Badge>
                            <Badge variant="outline">{testCase.priority}</Badge>
                          </div>
                          <h4 className="font-semibold">{testCase.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {testCase.description}
                          </p>
                          
                          <div className="mt-2 text-sm text-muted-foreground">
                            Steps: {testCase.steps.length} • 
                            Executions: {testCase.executionCount} • 
                            Pass Rate: {Math.round(testCase.passRate)}%
                          </div>
                        </div>
                        <Button 
                          onClick={() => executeTestCase(testCase.id)}
                          disabled={isLoading}
                          size="sm"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Execute
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Executions */}
        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Test Executions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testExecutions.length === 0 ? (
                <div className="text-center py-8">
                  <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Test Executions</h3>
                  <p className="text-muted-foreground">
                    Execute test cases to see results here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {testExecutions.map((execution) => (
                    <div key={execution.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getStatusColor(execution.status)}>
                              {getStatusIcon(execution.status)}
                              <span className="ml-1">{execution.status}</span>
                            </Badge>
                            <Badge variant="outline">{execution.environment}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {execution.startTime.toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-semibold">Test Execution {execution.id}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Test Case: {execution.testCaseId}
                          </p>
                          
                          {execution.duration && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Duration: {formatDuration(execution.duration)}
                            </div>
                          )}
                          
                          {execution.error && (
                            <div className="mt-2 text-sm text-red-600">
                              Error: {execution.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bug Bash */}
        <TabsContent value="bugbash" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Bug Bash Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bugBashSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Bug Bash Sessions</h3>
                  <p className="text-muted-foreground">
                    Start a bug bash session to hunt for bugs
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bugBashSessions.map((session) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getStatusColor(session.status)}>
                              {getStatusIcon(session.status)}
                              <span className="ml-1">{session.status}</span>
                            </Badge>
                            <Badge variant="outline">
                              {session.participants.length} participants
                            </Badge>
                            <Badge variant="outline">
                              {session.bugsFound.length} bugs found
                            </Badge>
                          </div>
                          <h4 className="font-semibold">{session.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {session.description}
                          </p>
                          
                          <div className="mt-2 text-sm text-muted-foreground">
                            Start: {session.startDate.toLocaleString()} • 
                            End: {session.endDate.toLocaleString()}
                          </div>
                          
                          {session.leaderboard.length > 0 && (
                            <div className="mt-4">
                              <h5 className="font-semibold text-sm mb-2">Leaderboard</h5>
                              <div className="space-y-1">
                                {session.leaderboard.slice(0, 3).map((entry) => (
                                  <div key={entry.participant} className="flex items-center justify-between text-sm">
                                    <span>#{entry.rank} {entry.participant}</span>
                                    <span>{entry.points} points ({entry.bugsFound} bugs)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
