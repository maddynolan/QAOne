/**
 * Enhanced Workflow Nodes - New Node Types for QA Platform
 * Includes: API, Database, Variables, Conditionals, Loops, Screenshots
 */

import React, { useState } from 'react';
import {
  Globe, Database, Variable, GitBranch, Repeat, Camera,
  CheckCircle, Clock, AlertTriangle, Code, FileJson,
  ArrowRightLeft, Layers, Settings, Play, Zap, Eye,
  Table, Send, Download, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Extended Node Types
export type ExtendedNodeType = 
  | 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'condition' | 'loop'
  // New types
  | 'api_request' | 'database_query' | 'set_variable' | 'screenshot' 
  | 'visual_compare' | 'loop_data' | 'try_catch' | 'parallel'
  | 'wait_condition' | 'import_element' | 'call_workflow';

export interface ExtendedNodeData {
  type: ExtendedNodeType;
  label: string;
  // Basic
  selector?: string;
  value?: string;
  url?: string;
  duration?: number;
  // API
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  apiUrl?: string;
  apiHeaders?: Record<string, string>;
  apiBody?: string;
  apiResponseVar?: string;
  // Database
  dbType?: 'postgresql' | 'mysql' | 'soql' | 'mongodb';
  dbQuery?: string;
  dbConnection?: string;
  dbResultVar?: string;
  // Variables
  varName?: string;
  varValue?: string;
  varExpression?: string;
  // Conditions
  conditionExpression?: string;
  trueBranch?: string[];
  falseBranch?: string[];
  // Loops
  loopType?: 'count' | 'data' | 'while';
  loopCount?: number;
  loopDataSource?: string;
  loopCondition?: string;
  loopItemVar?: string;
  // Screenshot
  screenshotName?: string;
  compareBaseline?: boolean;
  // Wait condition
  waitType?: 'element' | 'api' | 'variable' | 'timeout';
  waitExpression?: string;
  waitTimeout?: number;
  // Import from repository
  elementId?: string;
  elementName?: string;
  // Call workflow
  workflowId?: string;
  workflowParams?: Record<string, string>;
  // Environment
  envKey?: string;
  // Metadata
  description?: string;
  elementData?: Record<string, unknown>;
}

export interface ExtendedNode {
  id: string;
  position: { x: number; y: number };
  data: ExtendedNodeData;
  stepNumber?: number;
}

// Node type configurations
export const NODE_CONFIGS: Record<ExtendedNodeType, {
  label: string;
  icon: React.ElementType;
  color: string;
  category: 'basic' | 'api' | 'data' | 'control' | 'visual' | 'advanced';
  description: string;
}> = {
  // Basic
  navigate: { label: 'Navigate', icon: Globe, color: 'blue', category: 'basic', description: 'Go to URL' },
  click: { label: 'Click', icon: Play, color: 'green', category: 'basic', description: 'Click element' },
  input: { label: 'Input', icon: Code, color: 'purple', category: 'basic', description: 'Enter text' },
  wait: { label: 'Wait', icon: Clock, color: 'yellow', category: 'basic', description: 'Wait time' },
  assert: { label: 'Assert', icon: CheckCircle, color: 'red', category: 'basic', description: 'Verify element' },
  
  // API
  api_request: { label: 'API Request', icon: Send, color: 'cyan', category: 'api', description: 'HTTP request' },
  
  // Data
  database_query: { label: 'Database', icon: Database, color: 'orange', category: 'data', description: 'SQL/SOQL query' },
  set_variable: { label: 'Variable', icon: Variable, color: 'indigo', category: 'data', description: 'Store value' },
  
  // Control
  condition: { label: 'If/Else', icon: GitBranch, color: 'amber', category: 'control', description: 'Conditional branch' },
  loop: { label: 'Loop', icon: Repeat, color: 'pink', category: 'control', description: 'Repeat actions' },
  loop_data: { label: 'For Each', icon: Table, color: 'rose', category: 'control', description: 'Loop over data' },
  try_catch: { label: 'Try/Catch', icon: AlertTriangle, color: 'red', category: 'control', description: 'Error handling' },
  parallel: { label: 'Parallel', icon: Layers, color: 'violet', category: 'control', description: 'Run in parallel' },
  wait_condition: { label: 'Wait Until', icon: Eye, color: 'teal', category: 'control', description: 'Wait for condition' },
  
  // Visual
  screenshot: { label: 'Screenshot', icon: Camera, color: 'emerald', category: 'visual', description: 'Capture screen' },
  visual_compare: { label: 'Visual Compare', icon: ArrowRightLeft, color: 'lime', category: 'visual', description: 'Compare screenshots' },
  
  // Advanced
  import_element: { label: 'Use Element', icon: Download, color: 'slate', category: 'advanced', description: 'From repository' },
  call_workflow: { label: 'Call Workflow', icon: Zap, color: 'fuchsia', category: 'advanced', description: 'Run sub-workflow' },
};

// Get icon component for node type
export const getNodeIcon = (type: ExtendedNodeType) => {
  const config = NODE_CONFIGS[type];
  return config ? config.icon : Zap;
};

// Get color for node type
export const getNodeColor = (type: ExtendedNodeType) => {
  const config = NODE_CONFIGS[type];
  return config ? config.color : 'gray';
};

// API Request Editor Component
export const APIRequestEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
}> = ({ data, onChange }) => {
  const [headersJson, setHeadersJson] = useState(
    data.apiHeaders ? JSON.stringify(data.apiHeaders, null, 2) : '{}'
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-1">
          <Label>Method</Label>
          <Select
            value={data.apiMethod || 'GET'}
            onValueChange={(v) => onChange('apiMethod', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3">
          <Label>URL</Label>
          <Input
            value={data.apiUrl || ''}
            onChange={(e) => onChange('apiUrl', e.target.value)}
            placeholder="https://api.example.com/endpoint or {{env.BASE_URL}}/api"
          />
        </div>
      </div>

      <div>
        <Label>Headers (JSON)</Label>
        <Textarea
          value={headersJson}
          onChange={(e) => {
            setHeadersJson(e.target.value);
            try {
              const parsed = JSON.parse(e.target.value);
              onChange('apiHeaders', parsed);
            } catch {}
          }}
          placeholder='{"Authorization": "Bearer {{token}}"}'
          className="font-mono text-xs h-20"
        />
      </div>

      {['POST', 'PUT', 'PATCH'].includes(data.apiMethod || '') && (
        <div>
          <Label>Request Body</Label>
          <Textarea
            value={data.apiBody || ''}
            onChange={(e) => onChange('apiBody', e.target.value)}
            placeholder='{"name": "{{varName}}", "email": "{{email}}"}'
            className="font-mono text-xs h-24"
          />
        </div>
      )}

      <div>
        <Label>Store Response In Variable</Label>
        <Input
          value={data.apiResponseVar || ''}
          onChange={(e) => onChange('apiResponseVar', e.target.value)}
          placeholder="apiResponse"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Access with {"{{apiResponse.data.id}}"} or {"{{apiResponse.status}}"}
        </p>
      </div>
    </div>
  );
};

// Database Query Editor Component
export const DatabaseQueryEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
}> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Database Type</Label>
        <Select
          value={data.dbType || 'soql'}
          onValueChange={(v) => onChange('dbType', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soql">Salesforce (SOQL)</SelectItem>
            <SelectItem value="postgresql">PostgreSQL</SelectItem>
            <SelectItem value="mysql">MySQL</SelectItem>
            <SelectItem value="mongodb">MongoDB</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Connection</Label>
        <Input
          value={data.dbConnection || ''}
          onChange={(e) => onChange('dbConnection', e.target.value)}
          placeholder="default or connection_id"
        />
      </div>

      <div>
        <Label>Query</Label>
        <Textarea
          value={data.dbQuery || ''}
          onChange={(e) => onChange('dbQuery', e.target.value)}
          placeholder={data.dbType === 'soql' 
            ? "SELECT Id, Name FROM Account WHERE Email = '{{email}}'"
            : "SELECT * FROM users WHERE email = '{{email}}'"}
          className="font-mono text-xs h-32"
        />
      </div>

      <div>
        <Label>Store Result In Variable</Label>
        <Input
          value={data.dbResultVar || ''}
          onChange={(e) => onChange('dbResultVar', e.target.value)}
          placeholder="dbResult"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Access with {"{{dbResult[0].Name}}"} or {"{{dbResult.length}}"}
        </p>
      </div>
    </div>
  );
};

// Variable Editor Component
export const VariableEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
}> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Variable Name</Label>
        <Input
          value={data.varName || ''}
          onChange={(e) => onChange('varName', e.target.value)}
          placeholder="myVariable"
        />
      </div>

      <div>
        <Label>Value or Expression</Label>
        <Textarea
          value={data.varValue || ''}
          onChange={(e) => onChange('varValue', e.target.value)}
          placeholder='Static value, {{otherVar}}, or {{apiResponse.data.id}}'
          className="font-mono text-xs h-20"
        />
      </div>

      <Card className="bg-muted">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Variable Sources:</strong>
          </p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
            <li>• Static: <code>"Hello World"</code></li>
            <li>• From element: <code>{"{{element.text}}"}</code></li>
            <li>• From API: <code>{"{{apiResponse.data.id}}"}</code></li>
            <li>• From DB: <code>{"{{dbResult[0].Name}}"}</code></li>
            <li>• Environment: <code>{"{{env.BASE_URL}}"}</code></li>
            <li>• Expression: <code>{"{{itemIndex + 1}}"}</code></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

// Loop Editor Component
export const LoopEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
}> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Loop Type</Label>
        <Select
          value={data.loopType || 'count'}
          onValueChange={(v) => onChange('loopType', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">Fixed Count</SelectItem>
            <SelectItem value="data">For Each (Data)</SelectItem>
            <SelectItem value="while">While Condition</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.loopType === 'count' && (
        <div>
          <Label>Iterations</Label>
          <Input
            type="number"
            value={data.loopCount || 5}
            onChange={(e) => onChange('loopCount', parseInt(e.target.value))}
            min={1}
            max={1000}
          />
        </div>
      )}

      {data.loopType === 'data' && (
        <>
          <div>
            <Label>Data Source</Label>
            <Input
              value={data.loopDataSource || ''}
              onChange={(e) => onChange('loopDataSource', e.target.value)}
              placeholder="{{dbResult}} or {{csvData}} or {{apiResponse.items}}"
            />
          </div>
          <div>
            <Label>Item Variable Name</Label>
            <Input
              value={data.loopItemVar || 'item'}
              onChange={(e) => onChange('loopItemVar', e.target.value)}
              placeholder="item"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Access current item with {"{{item.fieldName}}"} and index with {"{{itemIndex}}"}
            </p>
          </div>
        </>
      )}

      {data.loopType === 'while' && (
        <div>
          <Label>Condition</Label>
          <Input
            value={data.loopCondition || ''}
            onChange={(e) => onChange('loopCondition', e.target.value)}
            placeholder="{{counter}} < 10"
          />
        </div>
      )}
    </div>
  );
};

// Condition Editor Component
export const ConditionEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
}> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Condition Expression</Label>
        <Input
          value={data.conditionExpression || ''}
          onChange={(e) => onChange('conditionExpression', e.target.value)}
          placeholder="{{status}} === 'success' || {{retryCount}} > 0"
        />
      </div>

      <Card className="bg-muted">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Condition Examples:</strong>
          </p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
            <li>• Equality: <code>{"{{status}} === 'active'"}</code></li>
            <li>• Comparison: <code>{"{{count}} > 10"}</code></li>
            <li>• Exists: <code>{"{{element.visible}}"}</code></li>
            <li>• Contains: <code>{"{{text}}.includes('success')"}</code></li>
            <li>• Multiple: <code>{"{{a}} && {{b}} || {{c}}"}</code></li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-3 bg-green-50 border-green-200">
          <Label className="text-green-700">If True</Label>
          <p className="text-xs text-green-600 mt-1">
            Connect to nodes that run when condition is true
          </p>
        </div>
        <div className="border rounded-lg p-3 bg-red-50 border-red-200">
          <Label className="text-red-700">If False</Label>
          <p className="text-xs text-red-600 mt-1">
            Connect to nodes that run when condition is false
          </p>
        </div>
      </div>
    </div>
  );
};

// Screenshot Editor Component
export const ScreenshotEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
}> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Screenshot Name</Label>
        <Input
          value={data.screenshotName || ''}
          onChange={(e) => onChange('screenshotName', e.target.value)}
          placeholder="login_page_{{timestamp}}"
        />
      </div>

      <div>
        <Label>Element Selector (optional)</Label>
        <Input
          value={data.selector || ''}
          onChange={(e) => onChange('selector', e.target.value)}
          placeholder="Leave empty for full page, or specify selector"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="compareBaseline"
          checked={data.compareBaseline || false}
          onChange={(e) => onChange('compareBaseline', e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="compareBaseline">Compare with baseline (Visual Regression)</Label>
      </div>
    </div>
  );
};

// Wait Condition Editor Component
export const WaitConditionEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
}> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Wait For</Label>
        <Select
          value={data.waitType || 'element'}
          onValueChange={(v) => onChange('waitType', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="element">Element Visible</SelectItem>
            <SelectItem value="api">API Response</SelectItem>
            <SelectItem value="variable">Variable Value</SelectItem>
            <SelectItem value="timeout">Fixed Timeout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.waitType === 'element' && (
        <div>
          <Label>Element Selector</Label>
          <Input
            value={data.selector || ''}
            onChange={(e) => onChange('selector', e.target.value)}
            placeholder="page.getByRole('button', { name: 'Submit' })"
          />
        </div>
      )}

      {data.waitType === 'variable' && (
        <div>
          <Label>Condition</Label>
          <Input
            value={data.waitExpression || ''}
            onChange={(e) => onChange('waitExpression', e.target.value)}
            placeholder="{{status}} === 'complete'"
          />
        </div>
      )}

      <div>
        <Label>Timeout (ms)</Label>
        <Input
          type="number"
          value={data.waitTimeout || 30000}
          onChange={(e) => onChange('waitTimeout', parseInt(e.target.value))}
          min={1000}
          max={120000}
        />
      </div>
    </div>
  );
};

// Import Element Editor Component
export const ImportElementEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
  elements?: Array<{ id: string; name: string; selector: string }>;
}> = ({ data, onChange, elements = [] }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Select from Element Repository</Label>
        <Select
          value={data.elementId || ''}
          onValueChange={(v) => {
            onChange('elementId', v);
            const el = elements.find(e => e.id === v);
            if (el) {
              onChange('elementName', el.name);
              onChange('selector', el.selector);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose element..." />
          </SelectTrigger>
          <SelectContent>
            {elements.map(el => (
              <SelectItem key={el.id} value={el.id}>
                {el.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.elementId && (
        <Card className="bg-muted">
          <CardContent className="pt-4">
            <p className="text-xs">
              <strong>Element:</strong> {data.elementName}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {data.selector}
            </p>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" className="w-full" onClick={() => window.open('/elements', '_blank')}>
        <Download className="h-4 w-4 mr-2" />
        Open Element Repository
      </Button>
    </div>
  );
};

// Call Workflow Editor Component
export const CallWorkflowEditor: React.FC<{
  data: ExtendedNodeData;
  onChange: (field: keyof ExtendedNodeData, value: string | number | boolean | Record<string, unknown> | undefined) => void;
  workflows?: Array<{ id: string; name: string }>;
}> = ({ data, onChange, workflows = [] }) => {
  const [paramsJson, setParamsJson] = useState(
    data.workflowParams ? JSON.stringify(data.workflowParams, null, 2) : '{}'
  );

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Workflow</Label>
        <Select
          value={data.workflowId || ''}
          onValueChange={(v) => onChange('workflowId', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose workflow..." />
          </SelectTrigger>
          <SelectContent>
            {workflows.map(wf => (
              <SelectItem key={wf.id} value={wf.id}>
                {wf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Parameters (JSON)</Label>
        <Textarea
          value={paramsJson}
          onChange={(e) => {
            setParamsJson(e.target.value);
            try {
              const parsed = JSON.parse(e.target.value);
              onChange('workflowParams', parsed);
            } catch {}
          }}
          placeholder='{"email": "{{currentEmail}}", "password": "{{password}}"}'
          className="font-mono text-xs h-20"
        />
      </div>
    </div>
  );
};

export default NODE_CONFIGS;

