import { GitBranch, Play, CheckCircle, XCircle, Clock, AlertCircle, Settings, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { cicdService, Pipeline, QualityGate, QualityGateResult } from "@/lib/cicd-service";
import { toast } from "sonner";

export default function CICD() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [qualityGates, setQualityGates] = useState<QualityGate[]>([]);
  const [gateResults, setGateResults] = useState<Map<string, QualityGateResult[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pipelines');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allPipelines = cicdService.getAllPipelines();
    const allGates = cicdService.getQualityGates();
    
    setPipelines(allPipelines);
    setQualityGates(allGates);
    
    // Load gate results
    const resultsMap = new Map<string, QualityGateResult[]>();
    allGates.forEach(gate => {
      const results = cicdService.getQualityGateResults(gate.id);
      resultsMap.set(gate.id, results);
    });
    setGateResults(resultsMap);
  };

  const triggerPipeline = async () => {
    setIsLoading(true);
    try {
      const projectId = "550e8400-e29b-41d4-a716-446655440001"; // Mock project ID
      const environment = "staging";
      const triggeredBy = "user@company.com";
      
      const pipelineId = await cicdService.triggerPipeline(projectId, environment, triggeredBy);
      const pipeline = cicdService.getPipeline(pipelineId);
      
      if (pipeline) {
        setPipelines(prev => [pipeline, ...prev]);
        toast.success("Pipeline triggered successfully!");
      }
    } catch (error) {
      toast.error(`Failed to trigger pipeline: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const executePipeline = async (pipelineId: string) => {
    setIsLoading(true);
    try {
      const pipeline = await cicdService.executePipeline(pipelineId);
      setPipelines(prev => prev.map(p => p.id === pipelineId ? pipeline : p));
      toast.success("Pipeline executed successfully!");
    } catch (error) {
      toast.error(`Failed to execute pipeline: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
      case 'pass':
        return 'default';
      case 'failed':
      case 'fail':
        return 'destructive';
      case 'running':
        return 'secondary';
      case 'warning':
        return 'secondary';
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
          <h1 className="text-3xl font-bold gradient-text">CI/CD & Quality Gates</h1>
          <p className="text-muted-foreground mt-1">Manage pipelines and quality gates</p>
        </div>
        <Button 
          onClick={triggerPipeline}
          disabled={isLoading}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Trigger Pipeline
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <GitBranch className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Pipelines</p>
                <p className="text-2xl font-bold">{pipelines.length}</p>
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
                <p className="text-2xl font-bold">
                  {pipelines.length > 0 
                    ? `${Math.round((pipelines.filter(p => p.status === 'passed').length / pipelines.length) * 100)}%`
                    : '0%'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Quality Gates</p>
                <p className="text-2xl font-bold">{qualityGates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Gates</p>
                <p className="text-2xl font-bold">{qualityGates.filter(g => g.enabled).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="gates">Quality Gates</TabsTrigger>
          <TabsTrigger value="results">Gate Results</TabsTrigger>
        </TabsList>

        {/* Pipelines */}
        <TabsContent value="pipelines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Recent Pipelines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pipelines.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Pipelines Yet</h3>
                  <p className="text-muted-foreground">
                    Trigger your first pipeline to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pipelines.map((pipeline) => (
                    <div key={pipeline.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getStatusColor(pipeline.status)}>
                              {getStatusIcon(pipeline.status)}
                              <span className="ml-1">{pipeline.status}</span>
                            </Badge>
                            <Badge variant="outline">{pipeline.environment}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {pipeline.triggeredAt.toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-semibold">{pipeline.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {pipeline.description}
                          </p>
                          
                          {pipeline.duration && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Duration: {formatDuration(pipeline.duration)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {pipeline.status === 'pending' && (
                            <Button 
                              onClick={() => executePipeline(pipeline.id)}
                              disabled={isLoading}
                              size="sm"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Execute
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </div>
                      
                      {/* Pipeline Stages */}
                      <div className="mt-4 space-y-2">
                        <h5 className="font-medium text-sm">Stages</h5>
                        <div className="grid grid-cols-3 gap-2">
                          {pipeline.stages.map((stage) => (
                            <div key={stage.id} className="border rounded p-2">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(stage.status)}
                                <span className="text-sm font-medium">{stage.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {stage.qualityGates.length} gates
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Gates */}
        <TabsContent value="gates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quality Gates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qualityGates.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Quality Gates</h3>
                  <p className="text-muted-foreground">
                    Create quality gates to ensure code quality
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {qualityGates.map((gate) => (
                    <div key={gate.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={gate.enabled ? 'default' : 'secondary'}>
                              {gate.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            {gate.lastResult && (
                              <Badge variant={getStatusColor(gate.lastResult)}>
                                {getStatusIcon(gate.lastResult)}
                                <span className="ml-1">{gate.lastResult}</span>
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold">{gate.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {gate.description}
                          </p>
                          
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                              <span className="text-sm text-muted-foreground">Min Success Rate:</span>
                              <span className="ml-2 font-medium">{gate.conditions.minSuccessRate}%</span>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Max Failure Rate:</span>
                              <span className="ml-2 font-medium">{gate.conditions.maxFailureRate}%</span>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Max Duration:</span>
                              <span className="ml-2 font-medium">{formatDuration(gate.conditions.maxDuration)}</span>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Min Coverage:</span>
                              <span className="ml-2 font-medium">{gate.conditions.minTestCoverage}%</span>
                            </div>
                          </div>
                          
                          {gate.lastEvaluated && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Last evaluated: {gate.lastEvaluated.toLocaleString()}
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

        {/* Gate Results */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Quality Gate Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Array.from(gateResults.entries()).length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Results Available</h3>
                  <p className="text-muted-foreground">
                    Run pipelines to see quality gate results
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(gateResults.entries()).map(([gateId, results]) => {
                    const gate = qualityGates.find(g => g.id === gateId);
                    if (!gate || results.length === 0) return null;
                    
                    return (
                      <div key={gateId} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <h4 className="font-semibold">{gate.name}</h4>
                          <Badge variant="outline">{results.length} results</Badge>
                        </div>
                        
                        <div className="space-y-2">
                          {results.slice(-5).map((result, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="flex items-center gap-2">
                                <Badge variant={getStatusColor(result.status)}>
                                  {getStatusIcon(result.status)}
                                  <span className="ml-1">{result.status}</span>
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {result.evaluatedAt.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span>Success: {Math.round(result.metrics.successRate)}%</span>
                                <span>Coverage: {Math.round(result.metrics.testCoverage)}%</span>
                                <span>Duration: {formatDuration(result.metrics.duration)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


