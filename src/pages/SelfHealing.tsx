import { Shield, Settings, Play, CheckCircle, XCircle, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { selfHealingService, SelfHealingRule, HealingSuggestion } from "@/lib/self-healing-service";
import { testExecutionService } from "@/lib/test-execution-service";
import { toast } from "sonner";

export default function SelfHealing() {
  const [rules, setRules] = useState<SelfHealingRule[]>([]);
  const [suggestions, setSuggestions] = useState<HealingSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');

  useEffect(() => {
    loadRules();
    loadSuggestions();
  }, []);

  const loadRules = () => {
    const allRules = selfHealingService.getRules();
    setRules(allRules);
  };

  const loadSuggestions = () => {
    // Get suggestions from recent test failures
    const testRuns = testExecutionService.getAllTestRuns();
    const allSuggestions: HealingSuggestion[] = [];

    testRuns.forEach(run => {
      run.results.forEach(result => {
        if (result.status === 'failed') {
          // Analyze failure and get suggestions
          selfHealingService.analyzeFailure(result).then(suggestions => {
            allSuggestions.push(...suggestions);
            setSuggestions(prev => [...prev, ...suggestions]);
          });
        }
      });
    });
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    setIsLoading(true);
    try {
      selfHealingService.updateRule(ruleId, { enabled });
      loadRules();
      toast.success(`Rule ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      toast.error(`Failed to update rule: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const applySuggestion = async (suggestion: HealingSuggestion) => {
    setIsLoading(true);
    try {
      const success = await selfHealingService.applyHealingSuggestion(suggestion);
      if (success) {
        toast.success("Healing suggestion applied successfully!");
        loadRules();
        loadSuggestions();
      } else {
        toast.error("Failed to apply healing suggestion");
      }
    } catch (error) {
      toast.error(`Failed to apply suggestion: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getRuleIcon = (rule: SelfHealingRule) => {
    switch (rule.actions.type) {
      case 'selector_update':
        return <Settings className="h-4 w-4" />;
      case 'wait_time_increase':
        return <Clock className="h-4 w-4" />;
      case 'retry_count_increase':
        return <Play className="h-4 w-4" />;
      case 'skip_test':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getRuleColor = (rule: SelfHealingRule) => {
    if (!rule.enabled) return 'secondary';
    if (rule.successRate > 0.8) return 'default';
    if (rule.successRate > 0.5) return 'secondary';
    return 'destructive';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-green-600';
    if (confidence > 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Self-Healing Hooks</h1>
        <p className="text-muted-foreground mt-1">Automated test failure recovery and optimization</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{rules.filter(r => r.enabled).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Suggestions</p>
                <p className="text-2xl font-bold">{suggestions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Success Rate</p>
                <p className="text-2xl font-bold">
                  {rules.length > 0 
                    ? `${Math.round(rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length * 100)}%`
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
              <Play className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Applied</p>
                <p className="text-2xl font-bold">
                  {rules.reduce((sum, r) => sum + r.appliedCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules">Healing Rules</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Healing Rules */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Self-Healing Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Rules Configured</h3>
                  <p className="text-muted-foreground">
                    Create self-healing rules to automatically fix test failures
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getRuleColor(rule)}>
                              {getRuleIcon(rule)}
                              <span className="ml-1">{rule.name}</span>
                            </Badge>
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(enabled) => toggleRule(rule.id, enabled)}
                              disabled={isLoading}
                            />
                          </div>
                          <h4 className="font-semibold">{rule.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {rule.description}
                          </p>
                          
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                              <span className="text-sm text-muted-foreground">Success Rate:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={rule.successRate * 100} className="h-2 flex-1" />
                                <span className="text-sm font-medium">
                                  {Math.round(rule.successRate * 100)}%
                                </span>
                              </div>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Applied:</span>
                              <span className="ml-2 font-medium">{rule.appliedCount} times</span>
                            </div>
                          </div>
                          
                          {rule.lastApplied && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Last applied: {rule.lastApplied.toLocaleString()}
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

        {/* Suggestions */}
        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Healing Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Suggestions Available</h3>
                  <p className="text-muted-foreground">
                    Run tests to generate healing suggestions
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">
                              Test: {suggestion.testId}
                            </Badge>
                            <Badge variant="outline">
                              Confidence: {Math.round(suggestion.confidence * 100)}%
                            </Badge>
                          </div>
                          <h4 className="font-semibold">{suggestion.suggestion}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Estimated success rate: {Math.round(suggestion.estimatedSuccessRate * 100)}%
                          </p>
                          
                          {Object.keys(suggestion.parameters).length > 0 && (
                            <div className="mt-2">
                              <span className="text-sm text-muted-foreground">Parameters:</span>
                              <pre className="text-xs bg-muted p-2 rounded mt-1">
                                {JSON.stringify(suggestion.parameters, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                        <Button 
                          onClick={() => applySuggestion(suggestion)}
                          disabled={isLoading}
                          size="sm"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Healing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No History Available</h3>
                <p className="text-muted-foreground">
                  Apply healing suggestions to see history here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
