/**
 * Salesforce Validation Panel Component
 * 
 * Provides:
 * - Salesforce org connection
 * - Metadata fetching
 * - Workflow validation
 * - Field/Object suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  Zap,
  ChevronDown,
  ChevronRight,
  Search,
  Settings,
  Play,
  Shield,
  Loader2
} from 'lucide-react';
import {
  salesforceService,
  SalesforceConnectionStatus,
  WorkflowValidationResult,
  WorkflowValidationStep,
  SalesforceObject,
  SalesforceField
} from '@/modules/salesforce/lib/salesforce-service';

interface SalesforceValidationPanelProps {
  nodes: Array<{ id: string; data: any }>;
  appType: string;
  onValidationComplete?: (result: WorkflowValidationResult) => void;
  isVisible?: boolean;
}

export function SalesforceValidationPanel({
  nodes,
  appType,
  onValidationComplete,
  isVisible = true
}: SalesforceValidationPanelProps) {
  const { toast } = useToast();

  // Connection state
  const [status, setStatus] = useState<SalesforceConnectionStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    security_token: '',
    domain: 'login' as 'login' | 'test'
  });

  // Metadata state
  const [objects, setObjects] = useState<SalesforceObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<string>('');
  const [fields, setFields] = useState<SalesforceField[]>([]);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // Validation state
  const [validationResult, setValidationResult] = useState<WorkflowValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const statusData = await salesforceService.getStatus();
      setStatus(statusData);
      
      if (statusData.loaded && statusData.objects_count > 0) {
        loadObjects();
      }
    } catch (error) {
      console.error('Failed to load Salesforce status:', error);
    }
  };

  const loadObjects = async () => {
    try {
      const data = await salesforceService.listObjects();
      setObjects(data.objects);
    } catch (error) {
      console.error('Failed to load objects:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await salesforceService.connect(credentials);
      
      if (result.connected) {
        toast({
          title: 'Connected to Salesforce',
          description: `Instance: ${result.instance_url}`
        });
        setShowConnectDialog(false);
        await loadStatus();
      } else {
        toast({
          title: 'Connection Failed',
          description: result.error || 'Check your credentials',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to Salesforce',
        variant: 'destructive'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await salesforceService.disconnect();
      setStatus(null);
      toast({ title: 'Disconnected from Salesforce' });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleFetchMetadata = async () => {
    setIsFetchingMetadata(true);
    try {
      const result = await salesforceService.fetchMetadata();
      
      if (result.success) {
        toast({
          title: 'Metadata Fetched',
          description: `Fetched ${result.objects_fetched} objects`
        });
        await loadStatus();
        await loadObjects();
      } else {
        toast({
          title: 'Fetch Failed',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Fetch Error',
        description: 'Failed to fetch metadata',
        variant: 'destructive'
      });
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleLoadFields = async (objectName: string) => {
    setSelectedObject(objectName);
    try {
      const data = await salesforceService.getObjectFields(objectName);
      setFields(data.fields);
    } catch (error) {
      console.error('Failed to load fields:', error);
    }
  };

  const handleValidateWorkflow = async () => {
    if (nodes.length === 0) {
      toast({
        title: 'No Steps',
        description: 'Add workflow steps to validate',
        variant: 'destructive'
      });
      return;
    }

    setIsValidating(true);
    try {
      const result = await salesforceService.validateWorkflow(nodes, appType);
      setValidationResult(result);
      onValidationComplete?.(result);

      if (result.workflow_valid) {
        toast({
          title: 'Validation Passed',
          description: `All ${result.total_steps} steps are valid`
        });
      } else {
        toast({
          title: 'Validation Issues Found',
          description: `${result.warnings_count} warnings in ${result.total_steps - result.valid_steps} steps`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Validation Error',
        description: 'Failed to validate workflow',
        variant: 'destructive'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const toggleStepExpanded = (stepIndex: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  };

  if (!isVisible || appType !== 'salesforce') {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Salesforce Validation</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {status?.connected_to_org ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-50 text-gray-500">
                <CloudOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Validate workflow against Salesforce org metadata
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="validate" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="validate">
              <Shield className="h-4 w-4 mr-1" />
              Validate
            </TabsTrigger>
            <TabsTrigger value="metadata">
              <Database className="h-4 w-4 mr-1" />
              Metadata
            </TabsTrigger>
            <TabsTrigger value="connection">
              <Settings className="h-4 w-4 mr-1" />
              Connect
            </TabsTrigger>
          </TabsList>

          {/* Validation Tab */}
          <TabsContent value="validate" className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleValidateWorkflow}
                disabled={isValidating || nodes.length === 0}
                className="flex-1"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Validate Workflow
              </Button>
            </div>

            {validationResult && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-1 p-2 bg-white rounded border">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{validationResult.valid_steps}/{validationResult.total_steps} Valid</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 bg-white rounded border">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>{validationResult.warnings_count} Warnings</span>
                  </div>
                  <div className="flex items-center gap-1 p-2 bg-white rounded border">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <span>{validationResult.summary.components_used.length} Components</span>
                  </div>
                </div>

                {/* Referenced Metadata */}
                {validationResult.summary.fields_referenced.length > 0 && (
                  <div className="p-2 bg-white rounded border">
                    <div className="text-xs font-medium text-gray-500 mb-1">Fields Referenced:</div>
                    <div className="flex flex-wrap gap-1">
                      {validationResult.summary.fields_referenced.map(field => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step Details */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {validationResult.steps.map((step, idx) => (
                    <Collapsible
                      key={idx}
                      open={expandedSteps.has(idx)}
                      onOpenChange={() => toggleStepExpanded(idx)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className={`flex items-center justify-between p-2 rounded border ${
                          step.step_valid ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            {expandedSteps.has(idx) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {step.step_valid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                            <span className="text-sm font-medium">{step.step_name}</span>
                          </div>
                          {step.warnings.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {step.warnings.length} warning{step.warnings.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-2 bg-white border border-t-0 rounded-b text-sm space-y-2">
                          {step.warnings.map((warning, wIdx) => (
                            <div key={wIdx} className="flex items-start gap-2 text-yellow-700">
                              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>{warning}</span>
                            </div>
                          ))}
                          {step.suggestions.map((suggestion, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-2 text-blue-700">
                              <Zap className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>{suggestion}</span>
                            </div>
                          ))}
                          {step.warnings.length === 0 && step.suggestions.length === 0 && (
                            <div className="text-gray-500 italic">No issues found</div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleFetchMetadata}
                disabled={isFetchingMetadata || !status?.connected_to_org}
                variant="outline"
                className="flex-1"
              >
                {isFetchingMetadata ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Fetch Metadata
              </Button>
            </div>

            {status && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-white rounded border">
                  <div className="text-gray-500">Objects Cached</div>
                  <div className="font-semibold">{status.objects_count}</div>
                </div>
                <div className="p-2 bg-white rounded border">
                  <div className="text-gray-500">Fields Cached</div>
                  <div className="font-semibold">{status.fields_count}</div>
                </div>
              </div>
            )}

            {objects.length > 0 && (
              <div className="space-y-2">
                <Label>Browse Object</Label>
                <Select value={selectedObject} onValueChange={handleLoadFields}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an object..." />
                  </SelectTrigger>
                  <SelectContent>
                    {objects.map(obj => (
                      <SelectItem key={obj.name} value={obj.name}>
                        {obj.label} ({obj.name})
                        {obj.custom && <Badge variant="secondary" className="ml-2 text-xs">Custom</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {fields.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Field</th>
                      <th className="p-2 text-left">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.slice(0, 50).map(field => (
                      <tr key={field.name} className="border-t hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{field.label}</div>
                          <div className="text-xs text-gray-500">{field.name}</div>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-3">
            {status?.connected_to_org ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    Connected to Salesforce
                  </div>
                  {status.instance_url && (
                    <div className="text-sm text-green-600 mt-1">
                      {status.instance_url}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  className="w-full"
                >
                  <CloudOff className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border rounded">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CloudOff className="h-5 w-5" />
                    Not connected to Salesforce
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Connect to validate against your org metadata
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      type="email"
                      placeholder="user@company.com"
                      value={credentials.username}
                      onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="Password"
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Security Token</Label>
                    <Input
                      type="password"
                      placeholder="Security Token (optional)"
                      value={credentials.security_token}
                      onChange={(e) => setCredentials({ ...credentials, security_token: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select
                      value={credentials.domain}
                      onValueChange={(v) => setCredentials({ ...credentials, domain: v as 'login' | 'test' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="login">Production</SelectItem>
                        <SelectItem value="test">Sandbox</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={isConnecting || !credentials.username || !credentials.password}
                    className="w-full"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Cloud className="h-4 w-4 mr-2" />
                    )}
                    Connect to Salesforce
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default SalesforceValidationPanel;












