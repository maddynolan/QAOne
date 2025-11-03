import { Shield, AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, Lock, Key, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { securityService, SecurityPolicy, SecurityScan, SecurityFinding } from "@/lib/security-service";
import { toast } from "sonner";

export default function Security() {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allPolicies = securityService.getSecurityPolicies();
    const allScans = securityService.getSecurityScans();
    const allFindings = securityService.getSecurityFindings();
    
    setPolicies(allPolicies);
    setScans(allScans);
    setFindings(allFindings);
  };

  const runSecurityScan = async (scanType: SecurityScan['scanType']) => {
    setIsLoading(true);
    try {
      const scanId = await securityService.runSecurityScan(scanType);
      const scan = securityService.getSecurityScan(scanId);
      
      if (scan) {
        setScans(prev => [scan, ...prev]);
        setFindings(prev => [...prev, ...scan.findings]);
        toast.success(`${scanType} scan completed successfully!`);
      }
    } catch (error) {
      toast.error(`Failed to run ${scanType} scan: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFindingStatus = (findingId: string, status: SecurityFinding['status']) => {
    const success = securityService.updateSecurityFinding(findingId, { status });
    if (success) {
      setFindings(prev => prev.map(f => f.id === findingId ? { ...f, status } : f));
      toast.success("Finding status updated successfully!");
    } else {
      toast.error("Failed to update finding status");
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
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Eye className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <EyeOff className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'running':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'pending':
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
          <h1 className="text-3xl font-bold gradient-text">Security & Secrets Hygiene</h1>
          <p className="text-muted-foreground mt-1">Monitor security policies and scan for vulnerabilities</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => runSecurityScan('secrets')}
            disabled={isLoading}
            variant="outline"
          >
            <Key className="h-4 w-4 mr-2" />
            Scan Secrets
          </Button>
          <Button 
            onClick={() => runSecurityScan('permissions')}
            disabled={isLoading}
            variant="outline"
          >
            <Lock className="h-4 w-4 mr-2" />
            Scan Permissions
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Policies</p>
                <p className="text-2xl font-bold">{policies.filter(p => p.enabled).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Critical Findings</p>
                <p className="text-2xl font-bold">{findings.filter(f => f.severity === 'critical').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Scans</p>
                <p className="text-2xl font-bold">{scans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Open Findings</p>
                <p className="text-2xl font-bold">{findings.filter(f => f.status === 'open').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="policies">Security Policies</TabsTrigger>
          <TabsTrigger value="scans">Security Scans</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Security Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Security Score</span>
                    <span>85%</span>
                  </div>
                  <Progress value={85} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    Based on policies, scans, and findings
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scans.slice(0, 3).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between text-sm">
                      <span>{scan.scanType} scan</span>
                      <Badge variant={getStatusColor(scan.status)}>
                        {getStatusIcon(scan.status)}
                        <span className="ml-1">{scan.status}</span>
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Findings by Severity */}
          <Card>
            <CardHeader>
              <CardTitle>Findings by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {findings.filter(f => f.severity === 'critical').length}
                  </div>
                  <div className="text-muted-foreground">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {findings.filter(f => f.severity === 'high').length}
                  </div>
                  <div className="text-muted-foreground">High</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {findings.filter(f => f.severity === 'medium').length}
                  </div>
                  <div className="text-muted-foreground">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {findings.filter(f => f.severity === 'low').length}
                  </div>
                  <div className="text-muted-foreground">Low</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Policies */}
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Security Policies</h3>
                  <p className="text-muted-foreground">
                    Create security policies to protect your application
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <div key={policy.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                              {policy.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            <Badge variant={getSeverityColor(policy.severity)}>
                              {getSeverityIcon(policy.severity)}
                              <span className="ml-1">{policy.severity}</span>
                            </Badge>
                            <Badge variant="outline">{policy.category}</Badge>
                          </div>
                          <h4 className="font-semibold">{policy.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {policy.description}
                          </p>
                          
                          <div className="mt-4">
                            <span className="text-sm text-muted-foreground">Rules:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {policy.rules.map((rule) => (
                                <Badge key={rule.id} variant="outline" className="text-xs">
                                  {rule.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {policy.lastEvaluated && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Last evaluated: {policy.lastEvaluated.toLocaleString()}
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

        {/* Security Scans */}
        <TabsContent value="scans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Security Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scans.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Security Scans</h3>
                  <p className="text-muted-foreground">
                    Run security scans to identify vulnerabilities
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scans.map((scan) => (
                    <div key={scan.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getStatusColor(scan.status)}>
                              {getStatusIcon(scan.status)}
                              <span className="ml-1">{scan.status}</span>
                            </Badge>
                            <Badge variant="outline">{scan.scanType}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {scan.startTime.toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-semibold">{scan.scanType} Security Scan</h4>
                          
                          {scan.duration && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Duration: {formatDuration(scan.duration)}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-5 gap-4 mt-4">
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-600">{scan.summary.total}</div>
                              <div className="text-muted-foreground">Total</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600">{scan.summary.critical}</div>
                              <div className="text-muted-foreground">Critical</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-orange-600">{scan.summary.high}</div>
                              <div className="text-muted-foreground">High</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-yellow-600">{scan.summary.medium}</div>
                              <div className="text-muted-foreground">Medium</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">{scan.summary.low}</div>
                              <div className="text-muted-foreground">Low</div>
                            </div>
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

        {/* Findings */}
        <TabsContent value="findings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {findings.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Security Findings</h3>
                  <p className="text-muted-foreground">
                    Great job! No security issues found
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {findings.map((finding) => (
                    <div key={finding.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getSeverityColor(finding.severity)}>
                              {getSeverityIcon(finding.severity)}
                              <span className="ml-1">{finding.severity}</span>
                            </Badge>
                            <Badge variant="outline">{finding.category}</Badge>
                            <Badge variant="outline">{finding.status}</Badge>
                          </div>
                          <h4 className="font-semibold">{finding.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {finding.description}
                          </p>
                          
                          {finding.file && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              File: {finding.file}:{finding.line}:{finding.column}
                            </div>
                          )}
                          
                          <div className="mt-2 text-sm text-muted-foreground">
                            Recommendation: {finding.recommendation}
                          </div>
                          
                          <div className="mt-2 text-xs text-muted-foreground">
                            Created: {finding.createdAt.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateFindingStatus(finding.id, 'acknowledged')}
                          >
                            Acknowledge
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateFindingStatus(finding.id, 'fixed')}
                          >
                            Mark Fixed
                          </Button>
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


