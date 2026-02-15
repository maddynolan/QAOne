/**
 * Salesforce Debug Log Analyzer
 * 
 * Analyzes and visualizes Salesforce debug logs.
 * Features:
 * - Fetch recent debug logs
 * - Parse and categorize log entries
 * - Performance analysis (CPU, SOQL, DML)
 * - Governor limit warnings
 * - Filter by category
 */

import { useState, useCallback, useMemo } from 'react';
import {
  FileText, Download, RefreshCw, Filter, AlertTriangle,
  Clock, Database, Code, Zap, ChevronDown, ChevronRight,
  Loader2, Search, BarChart, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { salesforceApi } from '@/modules/salesforce/lib/salesforce-api';

interface DebugLog {
  Id: string;
  LogUser: { Name: string };
  Operation: string;
  Application: string;
  Status: string;
  LogLength: number;
  StartTime: string;
  DurationMilliseconds: number;
  Request: string;
}

interface ParsedLogEntry {
  timestamp: string;
  category: string;
  type: string;
  message: string;
  duration?: number;
  line?: number;
}

interface LogStats {
  cpuTime: number;
  soqlQueries: number;
  soqlRows: number;
  dmlStatements: number;
  dmlRows: number;
  heapSize: number;
  callouts: number;
  emailInvocations: number;
}

interface SalesforceDebugLogAnalyzerProps {
  isConnected: boolean;
}

export function SalesforceDebugLogAnalyzer({ isConnected }: SalesforceDebugLogAnalyzerProps) {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [parsedEntries, setParsedEntries] = useState<ParsedLogEntry[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  const categories = [
    'all', 'APEX_CODE', 'APEX_PROFILING', 'CALLOUT', 'DB', 'NBA',
    'SYSTEM', 'VALIDATION', 'VISUALFORCE', 'WAVE', 'WORKFLOW'
  ];

  const loadLogs = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    setIsLoading(true);
    try {
      const query = `
        SELECT Id, LogUser.Name, Operation, Application, Status, 
               LogLength, StartTime, DurationMilliseconds, Request
        FROM ApexLog
        ORDER BY StartTime DESC
        LIMIT 50
      `;
      const result = await salesforceApi.toolingQuery<DebugLog>(query);
      setLogs(result.records);
      toast.success(`Loaded ${result.records.length} debug logs`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const loadLogContent = useCallback(async (logId: string) => {
    if (!isConnected) return;

    setIsLoading(true);
    setSelectedLogId(logId);
    try {
      // Fetch log body using REST API
      const currentOrg = salesforceApi.getCurrentOrg();
      if (!currentOrg) throw new Error('No org selected');
      
      const response = await fetch(
        `${currentOrg.instanceUrl}/services/data/v59.0/tooling/sobjects/ApexLog/${logId}/Body`,
        {
          headers: {
            'Authorization': `Bearer ${currentOrg.accessToken}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch log content');
      
      const content = await response.text();
      setLogContent(content);
      
      // Parse the log
      const parsed = parseLogContent(content);
      setParsedEntries(parsed.entries);
      setLogStats(parsed.stats);
      
      toast.success('Log loaded and parsed');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const parseLogContent = (content: string): { entries: ParsedLogEntry[]; stats: LogStats } => {
    const entries: ParsedLogEntry[] = [];
    const stats: LogStats = {
      cpuTime: 0,
      soqlQueries: 0,
      soqlRows: 0,
      dmlStatements: 0,
      dmlRows: 0,
      heapSize: 0,
      callouts: 0,
      emailInvocations: 0,
    };

    const lines = content.split('\n');
    
    for (const line of lines) {
      // Parse timestamp and category
      const match = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+)\s+\((\d+)\)\|([A-Z_]+)\|(.+)$/);
      if (match) {
        const [, timestamp, duration, category, message] = match;
        entries.push({
          timestamp,
          category,
          type: category.split('_')[0],
          message,
          duration: parseInt(duration),
        });

        // Extract stats
        if (message.includes('SOQL_EXECUTE_BEGIN')) {
          stats.soqlQueries++;
        }
        if (message.includes('Number of SOQL queries:')) {
          const numMatch = message.match(/Number of SOQL queries:\s*(\d+)/);
          if (numMatch) stats.soqlQueries = parseInt(numMatch[1]);
        }
        if (message.includes('Number of query rows:')) {
          const numMatch = message.match(/Number of query rows:\s*(\d+)/);
          if (numMatch) stats.soqlRows = parseInt(numMatch[1]);
        }
        if (message.includes('Number of DML statements:')) {
          const numMatch = message.match(/Number of DML statements:\s*(\d+)/);
          if (numMatch) stats.dmlStatements = parseInt(numMatch[1]);
        }
        if (message.includes('Number of DML rows:')) {
          const numMatch = message.match(/Number of DML rows:\s*(\d+)/);
          if (numMatch) stats.dmlRows = parseInt(numMatch[1]);
        }
        if (message.includes('Maximum CPU time:')) {
          const numMatch = message.match(/Maximum CPU time:\s*(\d+)/);
          if (numMatch) stats.cpuTime = parseInt(numMatch[1]);
        }
        if (message.includes('Maximum heap size:')) {
          const numMatch = message.match(/Maximum heap size:\s*(\d+)/);
          if (numMatch) stats.heapSize = parseInt(numMatch[1]);
        }
        if (message.includes('Number of callouts:')) {
          const numMatch = message.match(/Number of callouts:\s*(\d+)/);
          if (numMatch) stats.callouts = parseInt(numMatch[1]);
        }
        if (message.includes('Number of Email Invocations:')) {
          const numMatch = message.match(/Number of Email Invocations:\s*(\d+)/);
          if (numMatch) stats.emailInvocations = parseInt(numMatch[1]);
        }
      }
    }

    return { entries, stats };
  };

  const filteredEntries = useMemo(() => {
    return parsedEntries.filter(entry => {
      const matchesCategory = categoryFilter === 'all' || entry.category.startsWith(categoryFilter);
      const matchesSearch = !searchQuery || 
        entry.message.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesErrors = !showOnlyErrors || 
        entry.message.toLowerCase().includes('error') ||
        entry.message.toLowerCase().includes('exception') ||
        entry.message.toLowerCase().includes('fatal');
      return matchesCategory && matchesSearch && matchesErrors;
    });
  }, [parsedEntries, categoryFilter, searchQuery, showOnlyErrors]);

  const getEntryColor = (category: string): string => {
    if (category.startsWith('APEX')) return 'text-blue-400';
    if (category.startsWith('DB') || category.startsWith('SOQL')) return 'text-green-400';
    if (category.startsWith('DML')) return 'text-yellow-400';
    if (category.startsWith('CALLOUT')) return 'text-purple-400';
    if (category.startsWith('VALIDATION')) return 'text-orange-400';
    if (category.includes('ERROR') || category.includes('EXCEPTION')) return 'text-red-400';
    return 'text-slate-400';
  };

  const getStatStatus = (value: number, limit: number): 'good' | 'warning' | 'danger' => {
    const percentage = (value / limit) * 100;
    if (percentage >= 80) return 'danger';
    if (percentage >= 50) return 'warning';
    return 'good';
  };

  const governorLimits = {
    cpuTime: { limit: 10000, label: 'CPU Time (ms)' },
    soqlQueries: { limit: 100, label: 'SOQL Queries' },
    soqlRows: { limit: 50000, label: 'SOQL Rows' },
    dmlStatements: { limit: 150, label: 'DML Statements' },
    dmlRows: { limit: 10000, label: 'DML Rows' },
    heapSize: { limit: 6000000, label: 'Heap Size (bytes)' },
    callouts: { limit: 100, label: 'Callouts' },
    emailInvocations: { limit: 10, label: 'Email Invocations' },
  };

  return (
    <div className="space-y-4">
      {/* Log List */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Debug Logs</CardTitle>
              <CardDescription>Analyze Apex debug logs from your org</CardDescription>
            </div>
            <Button
              onClick={loadLogs}
              disabled={!isConnected || isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No debug logs found. Click Refresh to load logs.</p>
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {logs.map(log => (
                <div
                  key={log.Id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedLogId === log.Id
                      ? 'bg-blue-500/20 border border-blue-500/50'
                      : 'bg-secondary hover:bg-card'
                  }`}
                  onClick={() => loadLogContent(log.Id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-sm text-foreground font-medium">
                          {log.Operation}
                        </div>
                        <div className="text-xs text-slate-400">
                          {log.LogUser?.Name || 'Unknown User'} • {new Date(log.StartTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs text-blue-300 border-blue-500/50">
                        {(log.LogLength / 1024).toFixed(1)} KB
                      </Badge>
                      <Badge variant="outline" className="text-xs text-purple-300 border-purple-500/50">
                        {log.DurationMilliseconds} ms
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Governor Limits Stats */}
      {logStats && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Governor Limits Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(governorLimits).map(([key, config]) => {
                const value = logStats[key as keyof LogStats] || 0;
                const status = getStatStatus(value, config.limit);
                const percentage = Math.min((value / config.limit) * 100, 100);
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{config.label}</span>
                      <span className={
                        status === 'danger' ? 'text-red-400' :
                        status === 'warning' ? 'text-yellow-400' : 'text-green-400'
                      }>
                        {value.toLocaleString()} / {config.limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          status === 'danger' ? 'bg-red-500' :
                          status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log Content Viewer */}
      {selectedLogId && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-sm">Log Entries</CardTitle>
              <div className="flex items-center gap-3">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search log..."
                  className="w-40 h-8 bg-input border-border text-sm text-foreground"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-8 bg-input border-border text-sm text-foreground">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat === 'all' ? 'All Categories' : cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showErrors"
                    checked={showOnlyErrors}
                    onCheckedChange={(c) => setShowOnlyErrors(!!c)}
                  />
                  <Label htmlFor="showErrors" className="text-xs text-slate-400">
                    Errors only
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto space-y-1 font-mono text-xs">
              {filteredEntries.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No matching entries</p>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded hover:bg-card ${getEntryColor(entry.category)}`}
                  >
                    <span className="text-slate-500">[{entry.timestamp}]</span>
                    <span className="text-slate-400 mx-2">{entry.category}</span>
                    <span>{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SalesforceDebugLogAnalyzer;

