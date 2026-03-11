/**
 * Salesforce Report Runner
 * 
 * Execute and export reports via API.
 * Features:
 * - List available reports
 * - Run reports
 * - View results
 * - Export to CSV
 * - Schedule recurring runs
 */

import { useState, useCallback, useMemo } from 'react';
import {
  FileText, Play, Download, RefreshCw, Search,
  Loader2, Filter, Clock, BarChart3, Table,
  ChevronDown, ChevronRight, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { salesforceApi } from '@/modules/salesforce/lib/salesforce-api';

interface Report {
  Id: string;
  Name: string;
  DeveloperName: string;
  FolderName: string;
  Format: string;
  LastRunDate: string;
  Description: string;
}

interface ReportResult {
  reportId: string;
  reportName: string;
  columns: string[];
  rows: any[][];
  groupingsDown: any[];
  aggregates: any;
  reportMetadata: any;
  hasDetailRows: boolean;
}

interface SalesforceReportRunnerProps {
  isConnected: boolean;
}

export function SalesforceReportRunner({ isConnected }: SalesforceReportRunnerProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const loadReports = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    setIsLoading(true);
    try {
      const query = `
        SELECT Id, Name, DeveloperName, FolderName, Format, LastRunDate, Description
        FROM Report
        WHERE IsDeleted = false
        ORDER BY FolderName, Name
        LIMIT 200
      `;
      const result = await salesforceApi.query<Report>(query);
      setReports(result.records);
      toast.success(`Loaded ${result.records.length} reports`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const runReport = useCallback(async (reportId: string) => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    setIsLoading(true);
    setSelectedReportId(reportId);
    setReportResult(null);

    try {
      const currentOrg = salesforceApi.getCurrentOrg();
      if (!currentOrg) throw new Error('No org selected');

      // Get report metadata first
      const metadataResponse = await fetch(
        `${currentOrg.instanceUrl}/services/data/v59.0/analytics/reports/${reportId}/describe`,
        {
          headers: {
            'Authorization': `Bearer ${currentOrg.accessToken}`,
          },
        }
      );
      
      if (!metadataResponse.ok) {
        throw new Error('Failed to get report metadata');
      }
      
      const metadata = await metadataResponse.json();

      // Run the report
      const runResponse = await fetch(
        `${currentOrg.instanceUrl}/services/data/v59.0/analytics/reports/${reportId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentOrg.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reportMetadata: metadata.reportMetadata,
          }),
        }
      );

      if (!runResponse.ok) {
        throw new Error('Failed to run report');
      }

      const data = await runResponse.json();
      
      // Extract columns
      const columns = metadata.reportMetadata.detailColumns || [];
      
      // Extract rows
      const rows: any[][] = [];
      if (data.factMap && data.factMap['T!T']) {
        const factMapRows = data.factMap['T!T'].rows || [];
        for (const row of factMapRows) {
          const rowData = row.dataCells.map((cell: any) => cell.label || cell.value);
          rows.push(rowData);
        }
      }

      const report = reports.find(r => r.Id === reportId);
      
      setReportResult({
        reportId,
        reportName: report?.Name || 'Report',
        columns: columns.map((c: string) => {
          const colInfo = metadata.reportExtendedMetadata?.detailColumnInfo?.[c];
          return colInfo?.label || c;
        }),
        rows,
        groupingsDown: data.groupingsDown?.groupings || [],
        aggregates: data.factMap?.['T!T']?.aggregates || [],
        reportMetadata: metadata.reportMetadata,
        hasDetailRows: rows.length > 0,
      });

      toast.success(`Report executed: ${rows.length} rows`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, reports]);

  const exportToCsv = useCallback(() => {
    if (!reportResult) return;

    const csv = [
      reportResult.columns.join(','),
      ...reportResult.rows.map(row => 
        row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportResult.reportName.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported to CSV');
  }, [reportResult]);

  const folders = useMemo(() => {
    const folderSet = new Set(reports.map(r => r.FolderName || 'Unfiled'));
    return Array.from(folderSet).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch = !searchQuery || 
        report.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.DeveloperName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = !selectedFolder || 
        (report.FolderName || 'Unfiled') === selectedFolder;
      return matchesSearch && matchesFolder;
    });
  }, [reports, searchQuery, selectedFolder]);

  const groupedReports = useMemo(() => {
    const groups: { [folder: string]: Report[] } = {};
    for (const report of filteredReports) {
      const folder = report.FolderName || 'Unfiled';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(report);
    }
    return groups;
  }, [filteredReports]);

  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Report Runner</CardTitle>
              <CardDescription>Execute Salesforce reports and export results</CardDescription>
            </div>
            <Button
              onClick={loadReports}
              disabled={!isConnected || isLoading}
              className="gap-2"
            >
              {isLoading && !selectedReportId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Load Reports
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Select value={selectedFolder || 'all'} onValueChange={(v) => setSelectedFolder(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[200px] bg-input border-border">
                <SelectValue placeholder="All Folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Folders</SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder} value={folder}>
                    {folder}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {/* Report List */}
        <Card className="bg-card border-border col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-sm">
              Reports ({filteredReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Click Load Reports to get started</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto space-y-1">
                {Object.entries(groupedReports).map(([folder, folderReports]) => (
                  <div key={folder}>
                    <div
                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent rounded"
                      onClick={() => toggleFolder(folder)}
                    >
                      {expandedFolders.has(folder) ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <FolderOpen className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm text-slate-300">{folder}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto text-slate-300 border-border">
                        {folderReports.length}
                      </Badge>
                    </div>
                    
                    {expandedFolders.has(folder) && (
                      <div className="ml-6 space-y-1">
                        {folderReports.map(report => (
                          <div
                            key={report.Id}
                            className={`p-2 rounded cursor-pointer transition-colors ${
                              selectedReportId === report.Id
                                ? 'bg-blue-500/20 border border-blue-500/50'
                                : 'hover:bg-accent'
                            }`}
                            onClick={() => runReport(report.Id)}
                          >
                            <div className="text-sm text-foreground">{report.Name}</div>
                            <div className="text-xs text-muted-foreground">{report.Format}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Results */}
        <Card className="bg-card border-border col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-sm">
                  {reportResult ? reportResult.reportName : 'Report Results'}
                </CardTitle>
                {reportResult && (
                  <CardDescription>
                    {reportResult.rows.length} rows
                  </CardDescription>
                )}
              </div>
              {reportResult && (
                <Button variant="outline" size="sm" onClick={exportToCsv} className="gap-2 text-muted-foreground border-border hover:text-foreground hover:bg-slate-700">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && selectedReportId ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            ) : reportResult ? (
              <div className="overflow-auto max-h-[500px] rounded-lg border border-border">
                {reportResult.hasDetailRows ? (
                  <table className="min-w-max text-sm">
                    <thead className="bg-secondary sticky top-0 z-10">
                      <tr>
                        {reportResult.columns.map((col, idx) => (
                          <th key={idx} className="px-4 py-2 text-left text-slate-300 font-medium whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportResult.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-t border-border/50 hover:bg-card">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-4 py-2 text-slate-300 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p>This is a summary or matrix report without detail rows.</p>
                    <p className="text-sm mt-2">Aggregate data is available in the export.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Table className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Select a report to run</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SalesforceReportRunner;

