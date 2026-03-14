/**
 * Variable Store - Manage variables and data sources for workflow execution
 * Supports static values, environment variables, CSV/JSON data, and runtime values
 */

import React, { useState, useEffect } from 'react';
import {
  Variable, Plus, Trash2, Edit2, Upload, Download,
  FileJson, Table, Lock, Eye, EyeOff, RefreshCw,
  Search, Filter, Copy, Check, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'secret';
  value: string | number | boolean | Record<string, unknown> | unknown[];
  source: 'static' | 'environment' | 'runtime' | 'data_source';
  description?: string;
  isSecret?: boolean;
  dataSourceId?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'csv' | 'json' | 'excel' | 'api';
  data: Record<string, unknown>[];
  columns?: string[];
  currentIndex: number;
  totalRows: number;
}

interface VariableStoreProps {
  variables: WorkflowVariable[];
  dataSources: DataSource[];
  onVariablesChange: (variables: WorkflowVariable[]) => void;
  onDataSourcesChange: (dataSources: DataSource[]) => void;
  onInsertVariable?: (varName: string) => void;
}

export default function VariableStore({
  variables,
  dataSources,
  onVariablesChange,
  onDataSourcesChange,
  onInsertVariable,
}: VariableStoreProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [editingVariable, setEditingVariable] = useState<WorkflowVariable | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('variables');

  const [newVar, setNewVar] = useState<Partial<WorkflowVariable>>({
    name: '',
    type: 'string',
    value: '',
    source: 'static',
    description: '',
  });

  const [csvContent, setCsvContent] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [dataSourceName, setDataSourceName] = useState('');

  const addVariable = () => {
    if (!newVar.name?.trim()) {
      toast.error('Variable name is required');
      return;
    }

    if (variables.some(v => v.name === newVar.name && v.id !== editingVariable?.id)) {
      toast.error('Variable name already exists');
      return;
    }

    const variable: WorkflowVariable = {
      id: editingVariable?.id || `var-${Date.now()}`,
      name: newVar.name!,
      type: newVar.type as WorkflowVariable['type'],
      value: newVar.value,
      source: newVar.source as WorkflowVariable['source'],
      description: newVar.description,
      isSecret: newVar.type === 'secret',
    };

    if (editingVariable) {
      onVariablesChange(variables.map(v => v.id === editingVariable.id ? variable : v));
      toast.success('Variable updated');
    } else {
      onVariablesChange([...variables, variable]);
      toast.success('Variable added');
    }

    setShowAddDialog(false);
    setEditingVariable(null);
    setNewVar({ name: '', type: 'string', value: '', source: 'static', description: '' });
  };

  const deleteVariable = (varId: string) => {
    onVariablesChange(variables.filter(v => v.id !== varId));
    toast.success('Variable deleted');
  };

  const toggleSecretVisibility = (varId: string) => {
    const newShow = new Set(showSecrets);
    if (newShow.has(varId)) {
      newShow.delete(varId);
    } else {
      newShow.add(varId);
    }
    setShowSecrets(newShow);
  };

  const copyVariableReference = (varName: string) => {
    const ref = `{{${varName}}}`;
    navigator.clipboard.writeText(ref);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 2000);
    toast.success(`Copied ${ref} to clipboard`);
  };

  const importDataFromCSV = () => {
    if (!csvContent.trim() || !dataSourceName.trim()) {
      toast.error('Please provide data source name and CSV content');
      return;
    }

    try {
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.trim() || '';
        });
        return row;
      });

      const dataSource: DataSource = {
        id: `ds-${Date.now()}`,
        name: dataSourceName,
        type: 'csv',
        data,
        columns: headers,
        currentIndex: 0,
        totalRows: data.length,
      };

      onDataSourcesChange([...dataSources, dataSource]);
      setCsvContent('');
      setDataSourceName('');
      setShowDataDialog(false);
      toast.success(`Imported ${data.length} rows from CSV`);
    } catch (error) {
      toast.error('Failed to parse CSV data');
    }
  };

  const importDataFromJSON = () => {
    if (!jsonContent.trim() || !dataSourceName.trim()) {
      toast.error('Please provide data source name and JSON content');
      return;
    }

    try {
      const data = JSON.parse(jsonContent);
      const rows = Array.isArray(data) ? data : [data];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      const dataSource: DataSource = {
        id: `ds-${Date.now()}`,
        name: dataSourceName,
        type: 'json',
        data: rows,
        columns,
        currentIndex: 0,
        totalRows: rows.length,
      };

      onDataSourcesChange([...dataSources, dataSource]);
      setJsonContent('');
      setDataSourceName('');
      setShowDataDialog(false);
      toast.success(`Imported ${rows.length} rows from JSON`);
    } catch (error) {
      toast.error('Failed to parse JSON data');
    }
  };

  const deleteDataSource = (dsId: string) => {
    onDataSourcesChange(dataSources.filter(ds => ds.id !== dsId));
    toast.success('Data source deleted');
  };

  const filteredVariables = variables.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeColor = (type: WorkflowVariable['type']) => {
    const colors: Record<string, string> = {
      string: 'bg-blue-100 text-blue-800',
      number: 'bg-green-100 text-green-800',
      boolean: 'bg-purple-100 text-purple-800',
      object: 'bg-orange-100 text-orange-800',
      array: 'bg-pink-100 text-pink-800',
      secret: 'bg-red-100 text-red-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatValue = (variable: WorkflowVariable) => {
    if (variable.isSecret || variable.type === 'secret') {
      return showSecrets.has(variable.id) ? String(variable.value) : '••••••••';
    }
    if (typeof variable.value === 'object') {
      return JSON.stringify(variable.value).substring(0, 50) + '...';
    }
    return String(variable.value).substring(0, 50);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="variables">
            <Variable className="h-4 w-4 mr-1" />
            Variables ({variables.length})
          </TabsTrigger>
          <TabsTrigger value="data">
            <Table className="h-4 w-4 mr-1" />
            Data Sources ({dataSources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variables" className="space-y-4">
          {/* Search and Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search variables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Variables List */}
          <div className="space-y-2">
            {filteredVariables.length === 0 ? (
              <Card className="p-8 text-center">
                <Variable className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No variables defined</p>
                <Button
                  variant="link"
                  onClick={() => setShowAddDialog(true)}
                  className="mt-2"
                >
                  Add your first variable
                </Button>
              </Card>
            ) : (
              filteredVariables.map(variable => (
                <Card key={variable.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {variable.type === 'secret' && <Lock className="h-4 w-4 text-red-500" />}
                      <span className="font-mono font-medium">{variable.name}</span>
                      <Badge className={getTypeColor(variable.type)}>
                        {variable.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {variable.source}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyVariableReference(variable.name)}
                        aria-label={`Copy reference for ${variable.name}`}
                      >
                        {copiedVar === variable.name ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      {variable.type === 'secret' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecretVisibility(variable.id)}
                          aria-label={showSecrets.has(variable.id) ? `Hide ${variable.name} value` : `Show ${variable.name} value`}
                        >
                          {showSecrets.has(variable.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingVariable(variable);
                          setNewVar(variable);
                          setShowAddDialog(true);
                        }}
                        aria-label={`Edit variable ${variable.name}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVariable(variable.id)}
                        aria-label={`Delete variable ${variable.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {formatValue(variable)}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {variable.description}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Quick Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Reference</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <p>Use <code>{"{{varName}}"}</code> to reference variables</p>
              <p>Access object properties: <code>{"{{user.email}}"}</code></p>
              <p>Access array items: <code>{"{{items[0].name}}"}</code></p>
              <p>Environment: <code>{"{{env.BASE_URL}}"}</code></p>
              <p>Data row: <code>{"{{row.column_name}}"}</code></p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Import test data for data-driven testing
            </p>
            <Button onClick={() => setShowDataDialog(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Import Data
            </Button>
          </div>

          {dataSources.length === 0 ? (
            <Card className="p-8 text-center">
              <FileJson className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No data sources</p>
              <Button
                variant="link"
                onClick={() => setShowDataDialog(true)}
                className="mt-2"
              >
                Import CSV or JSON data
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {dataSources.map(ds => (
                <Card key={ds.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ds.type === 'csv' ? (
                          <Table className="h-4 w-4 text-green-500" />
                        ) : (
                          <FileJson className="h-4 w-4 text-blue-500" />
                        )}
                        <CardTitle className="text-sm">{ds.name}</CardTitle>
                        <Badge variant="outline">{ds.type.toUpperCase()}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteDataSource(ds.id)}
                        aria-label={`Delete data source ${ds.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <CardDescription>
                      {ds.totalRows} rows • {ds.columns?.length} columns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <UITable>
                        <TableHeader>
                          <TableRow>
                            {ds.columns?.slice(0, 5).map(col => (
                              <TableHead key={col} className="text-xs">
                                {col}
                              </TableHead>
                            ))}
                            {(ds.columns?.length || 0) > 5 && (
                              <TableHead className="text-xs">...</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ds.data.slice(0, 3).map((row, idx) => (
                            <TableRow key={idx}>
                              {ds.columns?.slice(0, 5).map(col => (
                                <TableCell key={col} className="text-xs">
                                  {String(row[col]).substring(0, 20)}
                                </TableCell>
                              ))}
                              {(ds.columns?.length || 0) > 5 && (
                                <TableCell className="text-xs">...</TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </UITable>
                    </div>
                    {ds.totalRows > 3 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Showing 3 of {ds.totalRows} rows
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Variable Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setEditingVariable(null);
          setNewVar({ name: '', type: 'string', value: '', source: 'static', description: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariable ? 'Edit Variable' : 'Add Variable'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Variable Name</Label>
              <Input
                value={newVar.name || ''}
                onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
                placeholder="myVariable"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={newVar.type || 'string'}
                  onValueChange={(v) => setNewVar({ ...newVar, type: v as WorkflowVariable['type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="object">Object</SelectItem>
                    <SelectItem value="array">Array</SelectItem>
                    <SelectItem value="secret">Secret (Hidden)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source</Label>
                <Select
                  value={newVar.source || 'static'}
                  onValueChange={(v) => setNewVar({ ...newVar, source: v as WorkflowVariable['source'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static Value</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="runtime">Runtime (Set by test)</SelectItem>
                    <SelectItem value="data_source">Data Source</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Value</Label>
              {newVar.type === 'boolean' ? (
                <Select
                  value={String(newVar.value)}
                  onValueChange={(v) => setNewVar({ ...newVar, value: v === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : ['object', 'array'].includes(newVar.type || '') ? (
                <Textarea
                  value={typeof newVar.value === 'object' ? JSON.stringify(newVar.value, null, 2) : newVar.value || ''}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setNewVar({ ...newVar, value: parsed });
                    } catch {
                      setNewVar({ ...newVar, value: e.target.value });
                    }
                  }}
                  placeholder={newVar.type === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}
                  className="font-mono text-xs h-24"
                />
              ) : (
                <Input
                  type={newVar.type === 'number' ? 'number' : newVar.type === 'secret' ? 'password' : 'text'}
                  value={newVar.value || ''}
                  onChange={(e) => setNewVar({ 
                    ...newVar, 
                    value: newVar.type === 'number' ? Number(e.target.value) : e.target.value 
                  })}
                  placeholder="Enter value..."
                />
              )}
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={newVar.description || ''}
                onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
                placeholder="What is this variable for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addVariable}>
              {editingVariable ? 'Update' : 'Add'} Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Data Dialog */}
      <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Test Data</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="csv">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="csv">CSV</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-4">
              <div>
                <Label>Data Source Name</Label>
                <Input
                  value={dataSourceName}
                  onChange={(e) => setDataSourceName(e.target.value)}
                  placeholder="e.g., user_test_data"
                />
              </div>
              <div>
                <Label>CSV Content</Label>
                <Textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="email,password,name
user1@test.com,Pass123!,John Doe
user2@test.com,Pass456!,Jane Smith"
                  className="font-mono text-xs h-40"
                />
              </div>
              <Button onClick={importDataFromCSV} className="w-full">
                <Upload className="h-4 w-4 mr-1" />
                Import CSV
              </Button>
            </TabsContent>

            <TabsContent value="json" className="space-y-4">
              <div>
                <Label>Data Source Name</Label>
                <Input
                  value={dataSourceName}
                  onChange={(e) => setDataSourceName(e.target.value)}
                  placeholder="e.g., api_test_data"
                />
              </div>
              <div>
                <Label>JSON Content</Label>
                <Textarea
                  value={jsonContent}
                  onChange={(e) => setJsonContent(e.target.value)}
                  placeholder='[
  {"email": "user1@test.com", "password": "Pass123!", "name": "John"},
  {"email": "user2@test.com", "password": "Pass456!", "name": "Jane"}
]'
                  className="font-mono text-xs h-40"
                />
              </div>
              <Button onClick={importDataFromJSON} className="w-full">
                <Upload className="h-4 w-4 mr-1" />
                Import JSON
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

