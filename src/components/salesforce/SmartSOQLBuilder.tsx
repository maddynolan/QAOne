/**
 * Smart SOQL Builder - Full Width Layout
 * 
 * Interactive SOQL query builder with live Salesforce metadata
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import {
  Database, Play, Plus, Copy, RefreshCw, Loader2, 
  Code, Filter, Search, Trash2, CheckCircle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi, SObjectDescribe, SObjectField, PicklistValue } from '@/lib/salesforce-api';
import { cn } from '@/lib/utils';

interface WhereCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  valueType: 'text' | 'picklist' | 'number' | 'date' | 'boolean' | 'id';
  connector: 'AND' | 'OR';
}

interface SmartSOQLBuilderProps {
  onExecute?: (query: string, results: any) => void;
  onAddAsStep?: (step: { type: string; action: string; args: any }) => void;
  className?: string;
  initialObject?: string;
}

const STANDARD_OBJECTS = [
  'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event',
  'User', 'Campaign', 'Contract', 'Order', 'Product2', 'Quote'
];

const OPERATORS: Record<string, { label: string; value: string }[]> = {
  string: [
    { label: '=', value: '=' },
    { label: '≠', value: '!=' },
    { label: 'LIKE', value: 'LIKE' },
    { label: 'IN', value: 'IN' },
    { label: 'NULL', value: 'IS_NULL' },
  ],
  number: [
    { label: '=', value: '=' },
    { label: '≠', value: '!=' },
    { label: '>', value: '>' },
    { label: '≥', value: '>=' },
    { label: '<', value: '<' },
    { label: '≤', value: '<=' },
  ],
  date: [
    { label: '=', value: '=' },
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: 'TODAY', value: 'TODAY' },
    { label: 'LAST_N_DAYS', value: 'LAST_N_DAYS' },
  ],
  boolean: [{ label: '=', value: '=' }],
  picklist: [
    { label: '=', value: '=' },
    { label: '≠', value: '!=' },
    { label: 'IN', value: 'IN' },
  ],
  reference: [
    { label: '=', value: '=' },
    { label: '≠', value: '!=' },
    { label: 'NULL', value: 'IS_NULL' },
  ],
};

export function SmartSOQLBuilder({
  onExecute,
  onAddAsStep,
  className,
  initialObject
}: SmartSOQLBuilderProps) {
  const [allObjects, setAllObjects] = useState<{ name: string; label: string; custom: boolean }[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [objectSearch, setObjectSearch] = useState('');
  const [selectedObject, setSelectedObject] = useState<string>(initialObject || '');
  const [objectDescribe, setObjectDescribe] = useState<SObjectDescribe | null>(null);
  const [loadingDescribe, setLoadingDescribe] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['Id', 'Name']));
  const [fieldSearch, setFieldSearch] = useState('');
  const [selectedRecordType, setSelectedRecordType] = useState<string>('all');
  const [whereConditions, setWhereConditions] = useState<WhereCondition[]>([]);
  const [orderByField, setOrderByField] = useState<string>('__none__');
  const [orderByDir, setOrderByDir] = useState<'ASC' | 'DESC'>('ASC');
  const [limit, setLimit] = useState<number>(100);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [rawQuery, setRawQuery] = useState('');

  useEffect(() => { loadAllObjects(); }, []);
  useEffect(() => { if (selectedObject) loadObjectDescribe(selectedObject); }, [selectedObject]);

  const loadAllObjects = async () => {
    setLoadingObjects(true);
    try {
      const result = await salesforceApi.describeGlobal();
      setAllObjects(result.sobjects?.filter((o: any) => o.queryable).map((o: any) => ({
        name: o.name, label: o.label, custom: o.custom
      })).sort((a: any, b: any) => a.label.localeCompare(b.label)) || []);
    } catch (e) {
      setAllObjects(STANDARD_OBJECTS.map(name => ({ name, label: name, custom: false })));
    } finally {
      setLoadingObjects(false);
    }
  };

  const loadObjectDescribe = async (objectName: string) => {
    setLoadingDescribe(true);
    try {
      const describe = await salesforceApi.describeSObject(objectName);
      setObjectDescribe(describe);
      setSelectedFields(new Set(['Id', 'Name'].filter(f => describe.fields.some(df => df.name === f))));
      setWhereConditions([]);
      setOrderByField('');
    } catch (e) {
      toast.error(`Failed to load ${objectName}`);
    } finally {
      setLoadingDescribe(false);
    }
  };

  const filteredObjects = useMemo(() => {
    if (!objectSearch.trim()) return allObjects;
    const s = objectSearch.toLowerCase();
    return allObjects.filter(o => o.name.toLowerCase().includes(s) || o.label.toLowerCase().includes(s));
  }, [allObjects, objectSearch]);

  const filteredFields = useMemo(() => {
    if (!objectDescribe?.fields) return [];
    if (!fieldSearch.trim()) return objectDescribe.fields;
    const s = fieldSearch.toLowerCase();
    return objectDescribe.fields.filter(f => f.name.toLowerCase().includes(s) || f.label.toLowerCase().includes(s));
  }, [objectDescribe?.fields, fieldSearch]);

  const getFieldType = (field: SObjectField): string => {
    if (['picklist', 'multipicklist'].includes(field.type)) return 'picklist';
    if (field.type === 'reference') return 'reference';
    if (field.type === 'boolean') return 'boolean';
    if (['date', 'datetime'].includes(field.type)) return 'date';
    if (['double', 'currency', 'percent', 'integer', 'int'].includes(field.type)) return 'number';
    return 'string';
  };

  const getOperatorsForField = (fieldName: string) => {
    const field = objectDescribe?.fields.find(f => f.name === fieldName);
    return field ? (OPERATORS[getFieldType(field)] || OPERATORS.string) : OPERATORS.string;
  };

  const getPicklistValues = (fieldName: string): PicklistValue[] => {
    return objectDescribe?.fields.find(f => f.name === fieldName)?.picklistValues?.filter(pv => pv.active) || [];
  };

  const addWhereCondition = () => {
    const firstField = objectDescribe?.fields.find(f => f.name === 'Name') || objectDescribe?.fields[0];
    if (!firstField) return;
    setWhereConditions(prev => [...prev, {
      id: `c_${Date.now()}`,
      field: firstField.name,
      operator: '=',
      value: '',
      valueType: getFieldType(firstField) as any,
      connector: 'AND'
    }]);
  };

  const updateWhereCondition = (id: string, updates: Partial<WhereCondition>) => {
    setWhereConditions(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (updates.field && updates.field !== c.field) {
        const field = objectDescribe?.fields.find(f => f.name === updates.field);
        if (field) {
          const ft = getFieldType(field);
          return { ...c, ...updates, operator: (OPERATORS[ft] || OPERATORS.string)[0]?.value || '=', valueType: ft as any, value: '' };
        }
      }
      return { ...c, ...updates };
    }));
  };

  const generatedQuery = useMemo(() => {
    if (!selectedObject || selectedFields.size === 0) return '';
    let q = `SELECT ${Array.from(selectedFields).join(', ')}\nFROM ${selectedObject}`;
    const whereParts: string[] = [];
    if (selectedRecordType !== 'all' && objectDescribe?.recordTypeInfos?.length) {
      whereParts.push(`RecordType.DeveloperName = '${selectedRecordType}'`);
    }
    whereConditions.forEach((cond, idx) => {
      if (!cond.field || !cond.operator) return;
      let clause = '';
      if (cond.operator === 'IS_NULL') clause = `${cond.field} = NULL`;
      else if (cond.operator === 'LIKE') clause = `${cond.field} LIKE '%${cond.value}%'`;
      else if (cond.operator === 'IN') {
        const vals = cond.value.split(',').map(v => `'${v.trim()}'`).join(', ');
        clause = `${cond.field} IN (${vals})`;
      } else if (['TODAY', 'LAST_N_DAYS'].includes(cond.operator)) {
        clause = `${cond.field} = ${cond.operator}${cond.operator === 'LAST_N_DAYS' ? ':' + (cond.value || '30') : ''}`;
      } else {
        const needsQuotes = ['string', 'picklist', 'reference'].includes(cond.valueType);
        clause = `${cond.field} ${cond.operator} ${needsQuotes ? `'${cond.value}'` : cond.value}`;
      }
      if (clause) whereParts.push(idx > 0 || whereParts.length > 0 ? `${cond.connector} ${clause}` : clause);
    });
    if (whereParts.length > 0) q += `\nWHERE ${whereParts.join('\n  ')}`;
    if (orderByField && orderByField !== '__none__') q += `\nORDER BY ${orderByField} ${orderByDir}`;
    if (limit > 0) q += `\nLIMIT ${limit}`;
    return q;
  }, [selectedObject, selectedFields, selectedRecordType, whereConditions, orderByField, orderByDir, limit, objectDescribe]);

  useEffect(() => { if (!showRawEditor) setRawQuery(generatedQuery); }, [generatedQuery, showRawEditor]);

  const executeQuery = async () => {
    const q = showRawEditor ? rawQuery : generatedQuery;
    if (!q.trim()) return toast.error('No query');
    setIsExecuting(true);
    setQueryError(null);
    setQueryResults(null);
    try {
      const result = await salesforceApi.query(q);
      setQueryResults(result);
      onExecute?.(q, result);
      toast.success(`${result.totalSize || 0} records`);
    } catch (e: any) {
      setQueryError(e.message || 'Query failed');
      toast.error(e.message || 'Query failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const addAsStep = (type: 'query' | 'assert') => {
    const q = showRawEditor ? rawQuery : generatedQuery;
    if (!q.trim()) return toast.error('No query');
    onAddAsStep?.({
      type: type === 'query' ? 'sf_soql' : 'sf_assert_soql',
      action: type === 'query' ? 'ExecuteSOQL' : 'AssertSOQL',
      args: {
        query: q,
        storeAs: type === 'query' ? `{{${selectedObject.toLowerCase()}Records}}` : undefined,
        assertion: type === 'assert' ? 'count > 0' : undefined,
        description: `${type === 'query' ? 'Query' : 'Assert'} ${selectedObject}`
      }
    });
    toast.success(`Added ${type === 'query' ? 'SOQL Query' : 'SOQL Assertion'} step`);
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden bg-[#0d0d14]", className)}>
      {/* Top Section - Object & Fields */}
      <div className="shrink-0 p-2 border-b border-white/10 space-y-2">
        {/* Object Picker Row */}
        <div className="flex items-center gap-2">
          <Select value={selectedObject} onValueChange={setSelectedObject}>
            <SelectTrigger className="h-8 flex-1 bg-[#1a1a25] border-blue-500/30 text-white text-xs">
              <SelectValue placeholder={loadingObjects ? "Loading..." : "Select Object"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] bg-[#1a1a25] border-white/10">
              <div className="p-1.5 border-b border-white/10">
                <Input
                  value={objectSearch}
                  onChange={(e) => setObjectSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-7 text-xs bg-[#0d0d14] border-white/10"
                />
              </div>
              {filteredObjects.slice(0, 100).filter(obj => obj.name).map(obj => (
                <SelectItem key={obj.name} value={obj.name} className="text-xs">
                  {obj.label} {obj.custom && <span className="text-amber-400 text-[9px]">•</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {objectDescribe?.recordTypeInfos && objectDescribe.recordTypeInfos.length > 1 && (
            <Select value={selectedRecordType} onValueChange={setSelectedRecordType}>
              <SelectTrigger className="h-8 w-32 bg-[#1a1a25] border-purple-500/30 text-white text-xs">
                <SelectValue placeholder="Record Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a25] border-white/10">
                <SelectItem value="all">All Types</SelectItem>
                {objectDescribe.recordTypeInfos.filter((rt: any) => rt.active && rt.developerName && rt.developerName !== 'Master').map((rt: any) => (
                  <SelectItem key={rt.recordTypeId} value={rt.developerName} className="text-xs">{rt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {objectDescribe && (
            <Badge variant="outline" className="h-6 px-2 text-[10px] border-blue-500/30 text-blue-400 shrink-0">
              {objectDescribe.fields.length} fields
            </Badge>
          )}
        </div>

        {/* Fields Selection */}
        {objectDescribe && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
              <Input
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Search fields..."
                className="h-7 pl-7 text-xs bg-[#1a1a25] border-white/10"
              />
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-blue-400" onClick={() => {
              setSelectedFields(new Set(['Id', 'Name', 'CreatedDate', 'LastModifiedDate'].filter(f => objectDescribe.fields.some(df => df.name === f))));
            }}>Common</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-gray-500" onClick={() => setSelectedFields(new Set(['Id']))}>Clear</Button>
          </div>
        )}
      </div>

      {/* Middle Section - Scrollable Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 pb-16 space-y-2">
          {loadingDescribe && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            </div>
          )}

          {objectDescribe && !loadingDescribe && (
            <>
              {/* Fields Grid */}
              <div className="bg-[#1a1a25] rounded border border-white/5 p-1.5 max-h-32 overflow-y-auto">
                <div className="grid grid-cols-3 gap-0.5">
                  {filteredFields.slice(0, 60).map(field => (
                    <label key={field.name} className={cn(
                      "flex items-center gap-1 px-1.5 py-1 rounded text-[10px] cursor-pointer hover:bg-white/5",
                      selectedFields.has(field.name) && "bg-blue-500/10"
                    )}>
                      <Checkbox
                        checked={selectedFields.has(field.name)}
                        onCheckedChange={(checked) => {
                          const nf = new Set(selectedFields);
                          checked ? nf.add(field.name) : nf.delete(field.name);
                          setSelectedFields(nf);
                        }}
                        className="h-3 w-3"
                      />
                      <span className="truncate text-gray-300" title={field.label}>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* WHERE Conditions */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase font-medium flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Where
                  </span>
                  <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] text-emerald-400" onClick={addWhereCondition}>
                    <Plus className="h-3 w-3 mr-0.5" /> Add
                  </Button>
                </div>
                {whereConditions.map((cond, idx) => {
                  const picklistValues = getPicklistValues(cond.field);
                  const operators = getOperatorsForField(cond.field);
                  return (
                    <div key={cond.id} className="flex items-center gap-1 p-1 bg-[#1a1a25] rounded border border-white/5">
                      {idx > 0 && (
                        <Select value={cond.connector} onValueChange={(v) => updateWhereCondition(cond.id, { connector: v as 'AND' | 'OR' })}>
                          <SelectTrigger className="h-6 w-14 text-[9px] bg-transparent border-white/10"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#1a1a25] border-white/10">
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Select value={cond.field} onValueChange={(v) => updateWhereCondition(cond.id, { field: v })}>
                        <SelectTrigger className="h-6 flex-1 text-[9px] bg-transparent border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#1a1a25] border-white/10 max-h-48">
                          {objectDescribe.fields.filter(f => f.name).map(f => (
                            <SelectItem key={f.name} value={f.name} className="text-xs">{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={cond.operator} onValueChange={(v) => updateWhereCondition(cond.id, { operator: v })}>
                        <SelectTrigger className="h-6 w-16 text-[9px] bg-transparent border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#1a1a25] border-white/10">
                          {operators.filter(op => op.value).map(op => <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!['IS_NULL', 'TODAY'].includes(cond.operator) && (
                        picklistValues.length > 0 ? (
                          <Select value={cond.value} onValueChange={(v) => updateWhereCondition(cond.id, { value: v })}>
                            <SelectTrigger className="h-6 flex-1 text-[9px] bg-transparent border-white/10"><SelectValue placeholder="Value" /></SelectTrigger>
                            <SelectContent className="bg-[#1a1a25] border-white/10 max-h-48">
                              {picklistValues.filter(pv => pv.value).map(pv => <SelectItem key={pv.value} value={pv.value} className="text-xs">{pv.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={cond.value} onChange={(e) => updateWhereCondition(cond.id, { value: e.target.value })} placeholder="Value" className="h-6 flex-1 text-[9px] bg-transparent border-white/10" />
                        )
                      )}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500 hover:text-red-400" onClick={() => setWhereConditions(prev => prev.filter(c => c.id !== cond.id))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Order & Limit */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-14">ORDER BY</span>
                <Select value={orderByField} onValueChange={setOrderByField}>
                  <SelectTrigger className="h-6 flex-1 text-[9px] bg-[#1a1a25] border-white/10"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a25] border-white/10 max-h-48">
                    <SelectItem value="__none__">None</SelectItem>
                    {Array.from(selectedFields).filter(f => f).map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={orderByDir} onValueChange={(v) => setOrderByDir(v as 'ASC' | 'DESC')}>
                  <SelectTrigger className="h-6 w-16 text-[9px] bg-[#1a1a25] border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a25] border-white/10">
                    <SelectItem value="ASC">ASC</SelectItem>
                    <SelectItem value="DESC">DESC</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-gray-500 ml-2">LIMIT</span>
                <Input type="number" value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 100)} className="h-6 w-16 text-[9px] bg-[#1a1a25] border-white/10" min={1} max={50000} />
              </div>

              {/* Generated Query */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase font-medium flex items-center gap-1">
                    <Code className="h-3 w-3" /> Query
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] text-gray-400" onClick={() => setShowRawEditor(!showRawEditor)}>
                      {showRawEditor ? 'Visual' : 'Edit'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] text-gray-400" onClick={() => { navigator.clipboard.writeText(showRawEditor ? rawQuery : generatedQuery); toast.success('Copied'); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {showRawEditor ? (
                  <textarea value={rawQuery} onChange={(e) => setRawQuery(e.target.value)} className="w-full h-20 p-2 rounded text-[10px] font-mono bg-[#1a1a25] border border-blue-500/20 text-blue-300 resize-none focus:outline-none" spellCheck={false} />
                ) : (
                  <div className="p-2 rounded bg-[#1a1a25] border border-white/5 max-h-20 overflow-auto">
                    <pre className="text-[10px] font-mono text-blue-300 whitespace-pre">{generatedQuery || 'Select an object and fields'}</pre>
                  </div>
                )}
              </div>

              {/* Results */}
              {queryError && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-400">{queryError}</p>
                  </div>
                </div>
              )}
              
              {queryResults && (
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500">{queryResults.totalSize || 0} records</span>
                  <div className="bg-[#1a1a25] rounded border border-white/5 max-h-48 overflow-auto">
                    {queryResults.records?.length > 0 ? (
                      <table className="w-full text-[9px]">
                        <thead className="bg-white/5 sticky top-0">
                          <tr>
                            {Object.keys(queryResults.records[0]).filter(k => k !== 'attributes').slice(0, 5).map(key => (
                              <th key={key} className="px-1.5 py-1 text-left text-gray-400 font-medium">{key}</th>
                            ))}
                            <th className="px-1.5 py-1 text-right text-gray-400 font-medium w-16">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.records.slice(0, 15).map((record: any, idx: number) => (
                            <tr key={idx} className="border-t border-white/5 hover:bg-white/5 group">
                              {Object.entries(record).filter(([k]) => k !== 'attributes').slice(0, 5).map(([key, value]: [string, any]) => (
                                <td key={key} className="px-1.5 py-1 text-gray-300 truncate max-w-[100px]">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</td>
                              ))}
                              <td className="px-1.5 py-0.5 text-right">
                                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      const recordId = record.Id || record.id;
                                      const recordName = record.Name || record.name || recordId;
                                      if (onAddAsStep) {
                                        onAddAsStep({
                                          type: 'sf_query_record',
                                          action: `Query ${selectedObject} Record`,
                                          object: selectedObject,
                                          recordId,
                                          recordName,
                                          query: `SELECT ${Array.from(selectedFields).join(', ')} FROM ${selectedObject} WHERE Id = '${recordId}'`
                                        });
                                        toast.success(`Added step for ${recordName}`);
                                      }
                                    }}
                                    className="h-5 px-1.5 text-[8px] rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 flex items-center gap-0.5"
                                    title="Add as step"
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                    Step
                                  </button>
                                  <button
                                    onClick={() => {
                                      const recordId = record.Id || record.id;
                                      const recordName = record.Name || record.name || recordId;
                                      if (onAddAsStep) {
                                        onAddAsStep({
                                          type: 'sf_assert_record',
                                          action: `Assert ${selectedObject} exists`,
                                          object: selectedObject,
                                          recordId,
                                          recordName,
                                          assertion: {
                                            type: 'record_exists',
                                            object: selectedObject,
                                            recordId,
                                            expectedFields: Object.fromEntries(
                                              Object.entries(record).filter(([k]) => k !== 'attributes').slice(0, 3)
                                            )
                                          }
                                        });
                                        toast.success(`Added assertion for ${recordName}`);
                                      }
                                    }}
                                    className="h-5 px-1.5 text-[8px] rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 flex items-center gap-0.5"
                                    title="Add as assertion"
                                  >
                                    <CheckCircle className="h-2.5 w-2.5" />
                                    Assert
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="p-2 text-center text-gray-500 text-[10px]">No records</p>}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Action Bar - Inside scroll area */}
          <div className="sticky bottom-0 mt-4 px-2 py-2 border-t border-white/10 bg-[#0d0d14] flex gap-1.5 -mx-2">
            <Button size="sm" className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-xs" onClick={executeQuery} disabled={isExecuting || !selectedObject}>
              {isExecuting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              Run
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10" onClick={() => addAsStep('query')} disabled={!selectedObject}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              +Step
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => addAsStep('assert')} disabled={!selectedObject}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              +Assert
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400" onClick={() => { navigator.clipboard.writeText(showRawEditor ? rawQuery : generatedQuery); toast.success('Copied'); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default SmartSOQLBuilder;
