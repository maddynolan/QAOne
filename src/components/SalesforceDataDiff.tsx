/**
 * Salesforce Data Diff Tool
 * 
 * Compare data between:
 * - Before/after test execution
 * - Two different orgs
 * - Two snapshots in time
 * 
 * Features:
 * - Side-by-side comparison
 * - Field-level diff highlighting
 * - Record count comparison
 * - Export diff report
 */

import { useState, useCallback, useMemo } from 'react';
import {
  GitCompare, Plus, Minus, Equal, RefreshCw, Download,
  Camera, Clock, Database, Loader2, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { salesforceApi } from '@/lib/salesforce-api';
import { STANDARD_OBJECT_TEMPLATES } from '@/lib/salesforce-test-data-factory';

interface DataSnapshot {
  id: string;
  name: string;
  timestamp: string;
  objectName: string;
  recordCount: number;
  records: any[];
  query: string;
}

interface DiffResult {
  added: any[];
  removed: any[];
  modified: Array<{
    id: string;
    before: any;
    after: any;
    changedFields: string[];
  }>;
  unchanged: number;
}

interface SalesforceDataDiffProps {
  isConnected: boolean;
}

export function SalesforceDataDiff({ isConnected }: SalesforceDataDiffProps) {
  const [snapshots, setSnapshots] = useState<DataSnapshot[]>([]);
  const [selectedObject, setSelectedObject] = useState('Account');
  const [customQuery, setCustomQuery] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [leftSnapshotId, setLeftSnapshotId] = useState<string | null>(null);
  const [rightSnapshotId, setRightSnapshotId] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  const objectOptions = useMemo(() => STANDARD_OBJECT_TEMPLATES.map(t => ({
    value: t.apiName,
    label: t.label,
  })), []);

  const getDefaultQuery = useCallback((objectName: string) => {
    const template = STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === objectName);
    const fields = template?.fields.slice(0, 10).map(f => f.name).join(', ') || 'Id, Name';
    return `SELECT Id, ${fields} FROM ${objectName} ORDER BY CreatedDate DESC LIMIT 100`;
  }, []);

  const takeSnapshot = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    const query = customQuery || getDefaultQuery(selectedObject);
    
    setIsLoading(true);
    try {
      const result = await salesforceApi.query(query);
      
      const snapshot: DataSnapshot = {
        id: `snapshot_${Date.now()}`,
        name: snapshotName || `${selectedObject} - ${new Date().toLocaleTimeString()}`,
        timestamp: new Date().toISOString(),
        objectName: selectedObject,
        recordCount: result.totalSize,
        records: result.records,
        query,
      };

      setSnapshots(prev => [snapshot, ...prev]);
      setSnapshotName('');
      toast.success(`Snapshot taken: ${snapshot.recordCount} records`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, selectedObject, customQuery, snapshotName, getDefaultQuery]);

  const compareSnapshots = useCallback(() => {
    if (!leftSnapshotId || !rightSnapshotId) {
      toast.error('Please select two snapshots to compare');
      return;
    }

    const leftSnapshot = snapshots.find(s => s.id === leftSnapshotId);
    const rightSnapshot = snapshots.find(s => s.id === rightSnapshotId);

    if (!leftSnapshot || !rightSnapshot) {
      toast.error('Snapshots not found');
      return;
    }

    // Build lookup maps
    const leftMap = new Map(leftSnapshot.records.map(r => [r.Id, r]));
    const rightMap = new Map(rightSnapshot.records.map(r => [r.Id, r]));

    const result: DiffResult = {
      added: [],
      removed: [],
      modified: [],
      unchanged: 0,
    };

    // Find added records (in right but not in left)
    rightSnapshot.records.forEach(record => {
      if (!leftMap.has(record.Id)) {
        result.added.push(record);
      }
    });

    // Find removed records (in left but not in right)
    leftSnapshot.records.forEach(record => {
      if (!rightMap.has(record.Id)) {
        result.removed.push(record);
      }
    });

    // Find modified records
    leftSnapshot.records.forEach(leftRecord => {
      const rightRecord = rightMap.get(leftRecord.Id);
      if (rightRecord) {
        const changedFields: string[] = [];
        
        Object.keys(leftRecord).forEach(key => {
          if (key === 'attributes') return;
          if (JSON.stringify(leftRecord[key]) !== JSON.stringify(rightRecord[key])) {
            changedFields.push(key);
          }
        });

        if (changedFields.length > 0) {
          result.modified.push({
            id: leftRecord.Id,
            before: leftRecord,
            after: rightRecord,
            changedFields,
          });
        } else {
          result.unchanged++;
        }
      }
    });

    setDiffResult(result);
    toast.success('Comparison complete');
  }, [leftSnapshotId, rightSnapshotId, snapshots]);

  const removeSnapshot = useCallback((id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
    if (leftSnapshotId === id) setLeftSnapshotId(null);
    if (rightSnapshotId === id) setRightSnapshotId(null);
    setDiffResult(null);
  }, [leftSnapshotId, rightSnapshotId]);

  const toggleRecordExpanded = useCallback((id: string) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const exportDiff = useCallback(() => {
    if (!diffResult) return;

    const report = {
      timestamp: new Date().toISOString(),
      left: snapshots.find(s => s.id === leftSnapshotId),
      right: snapshots.find(s => s.id === rightSnapshotId),
      summary: {
        added: diffResult.added.length,
        removed: diffResult.removed.length,
        modified: diffResult.modified.length,
        unchanged: diffResult.unchanged,
      },
      details: diffResult,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-diff-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Diff report exported');
  }, [diffResult, snapshots, leftSnapshotId, rightSnapshotId]);

  return (
    <div className="space-y-4">
      {/* Snapshot Creator */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white">Data Diff Tool</CardTitle>
          <CardDescription>Take snapshots and compare data changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Object</Label>
              <Select value={selectedObject} onValueChange={(v) => {
                setSelectedObject(v);
                setCustomQuery('');
              }}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {objectOptions.map(obj => (
                    <SelectItem key={obj.value} value={obj.value}>
                      {obj.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Snapshot Name (optional)</Label>
              <Input
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., Before test, After update"
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <Label>Custom SOQL (optional)</Label>
            <Textarea
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder={getDefaultQuery(selectedObject)}
              className="bg-slate-900 border-slate-700 text-white font-mono text-sm min-h-[80px]"
            />
          </div>

          <Button
            onClick={takeSnapshot}
            disabled={!isConnected || isLoading}
            className="mt-4 gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            Take Snapshot
          </Button>
        </CardContent>
      </Card>

      {/* Snapshots List */}
      {snapshots.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">Snapshots ({snapshots.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {snapshots.map(snapshot => (
                <div
                  key={snapshot.id}
                  className="p-3 rounded-lg bg-slate-900/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-sm text-white">{snapshot.name}</div>
                      <div className="text-xs text-slate-400">
                        {snapshot.objectName} • {snapshot.recordCount} records • {new Date(snapshot.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={leftSnapshotId === snapshot.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLeftSnapshotId(leftSnapshotId === snapshot.id ? null : snapshot.id)}
                    >
                      Left
                    </Button>
                    <Button
                      variant={rightSnapshotId === snapshot.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRightSnapshotId(rightSnapshotId === snapshot.id ? null : snapshot.id)}
                    >
                      Right
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSnapshot(snapshot.id)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {leftSnapshotId && rightSnapshotId && (
              <Button onClick={compareSnapshots} className="mt-4 gap-2 w-full">
                <GitCompare className="w-4 h-4" />
                Compare Selected Snapshots
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diff Results */}
      {diffResult && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Comparison Results</CardTitle>
                <CardDescription>
                  {snapshots.find(s => s.id === leftSnapshotId)?.name} vs {snapshots.find(s => s.id === rightSnapshotId)?.name}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showChangesOnly"
                    checked={showOnlyChanges}
                    onCheckedChange={(c) => setShowOnlyChanges(!!c)}
                  />
                  <Label htmlFor="showChangesOnly" className="text-xs text-slate-400">
                    Changes only
                  </Label>
                </div>
                <Button variant="outline" size="sm" onClick={exportDiff} className="gap-2 text-slate-200 border-slate-600 hover:text-white hover:bg-slate-700">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                <div className="text-2xl font-bold text-green-400">{diffResult.added.length}</div>
                <div className="text-xs text-green-400">Added</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                <div className="text-2xl font-bold text-red-400">{diffResult.removed.length}</div>
                <div className="text-xs text-red-400">Removed</div>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                <div className="text-2xl font-bold text-yellow-400">{diffResult.modified.length}</div>
                <div className="text-xs text-yellow-400">Modified</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/30 text-center">
                <div className="text-2xl font-bold text-slate-400">{diffResult.unchanged}</div>
                <div className="text-xs text-slate-400">Unchanged</div>
              </div>
            </div>

            {/* Details */}
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {/* Added Records */}
              {diffResult.added.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-green-400 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Added Records ({diffResult.added.length})
                  </div>
                  {diffResult.added.map(record => (
                    <div key={record.Id} className="p-2 rounded bg-green-500/5 border border-green-500/20 text-xs font-mono text-slate-300">
                      {record.Id} - {record.Name || JSON.stringify(record).slice(0, 100)}
                    </div>
                  ))}
                </div>
              )}

              {/* Removed Records */}
              {diffResult.removed.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-red-400 flex items-center gap-2">
                    <Minus className="w-4 h-4" />
                    Removed Records ({diffResult.removed.length})
                  </div>
                  {diffResult.removed.map(record => (
                    <div key={record.Id} className="p-2 rounded bg-red-500/5 border border-red-500/20 text-xs font-mono text-slate-300">
                      {record.Id} - {record.Name || JSON.stringify(record).slice(0, 100)}
                    </div>
                  ))}
                </div>
              )}

              {/* Modified Records */}
              {diffResult.modified.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Modified Records ({diffResult.modified.length})
                  </div>
                  {diffResult.modified.map(mod => (
                    <div
                      key={mod.id}
                      className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20"
                    >
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => toggleRecordExpanded(mod.id)}
                      >
                        {expandedRecords.has(mod.id) ? (
                          <ChevronDown className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-yellow-400" />
                        )}
                        <span className="text-xs font-mono text-slate-300">{mod.id}</span>
                        <Badge variant="outline" className="text-[10px] text-orange-300 border-orange-500/50">
                          {mod.changedFields.length} field(s) changed
                        </Badge>
                      </div>
                      {expandedRecords.has(mod.id) && (
                        <div className="mt-2 pl-6 space-y-1">
                          {mod.changedFields.map(field => (
                            <div key={field} className="text-xs">
                              <span className="text-slate-400">{field}:</span>
                              <span className="text-red-400 line-through ml-2">
                                {JSON.stringify(mod.before[field])}
                              </span>
                              <span className="text-green-400 ml-2">
                                {JSON.stringify(mod.after[field])}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SalesforceDataDiff;

