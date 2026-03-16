/**
 * ComplianceReportingPage — Generate & Download Compliance Reports
 *
 * SOC 2 Type II, HIPAA, GDPR, and Access Review reports.
 * Aggregates audit logs, access records, and change history.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield, FileText, Download, Clock, Users, Lock, Eye,
  CheckCircle2, AlertTriangle, Activity, BarChart3, RefreshCw,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ComplianceReport {
  id: string;
  report_type: string;
  title: string;
  date_range_start: string | null;
  date_range_end: string | null;
  summary: Record<string, any>;
  status: string;
  generated_by: string | null;
  created_at: string | null;
}

const REPORT_TYPES = [
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    description: 'Access controls, change management, availability evidence',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Healthcare data protection audit trail',
    icon: Lock,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
  },
  {
    id: 'gdpr',
    name: 'GDPR Privacy',
    description: 'Data inventory, processing basis, technical measures',
    icon: Eye,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
  },
  {
    id: 'access_review',
    name: 'Access Review',
    description: 'User access patterns, inactive accounts, service accounts',
    icon: Users,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
  },
];

export default function ComplianceReportingPage() {
  const [activeTab, setActiveTab] = useState('generate');
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Generate form
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Export form
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/compliance/reports/list');
      setReports(res.data.reports || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setReports([]);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async (reportType: string) => {
    setGenerating(reportType);
    try {
      const res = await apiClient.post('/api/compliance/reports/generate', {
        report_type: reportType,
        start_date: startDate,
        end_date: endDate,
      });
      setSelectedReport(res.data);
      setActiveTab('history');
      fetchReports();
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleViewReport = async (reportId: string) => {
    try {
      const res = await apiClient.get(`/api/compliance/reports/${reportId}`);
      setSelectedReport(res.data);
    } catch (err) {
      console.error('Failed to load report:', err);
    }
  };

  const handleExportAudit = async () => {
    setExporting(true);
    try {
      const res = await apiClient.post('/api/compliance/reports/audit-export', {
        start_date: startDate,
        end_date: endDate,
        format: exportFormat,
      });
      if (exportFormat === 'csv') {
        // Download CSV
        const blob = new Blob([res.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-trail-${startDate}-to-${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setSelectedReport(res.data);
      }
    } catch (err) {
      console.error('Audit export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const reportTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      soc2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      hipaa: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      gdpr: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      access_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    };
    return colors[type] || '';
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary" />
          Compliance Reporting
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate evidence reports for SOC 2, HIPAA, GDPR, and access reviews
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">Generate Reports</TabsTrigger>
          <TabsTrigger value="history">Report History ({reports.length})</TabsTrigger>
          <TabsTrigger value="export">Audit Export</TabsTrigger>
        </TabsList>

        {/* ==================== Generate Tab ==================== */}
        <TabsContent value="generate" className="space-y-4">
          {/* Date Range */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORT_TYPES.map(type => {
              const Icon = type.icon;
              return (
                <Card key={type.id} className={`${type.bgColor} border`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${type.color}`} />
                          <h3 className="font-semibold">{type.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {type.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleGenerate(type.id)}
                        disabled={generating !== null}
                      >
                        {generating === type.id ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4 mr-1" />
                        )}
                        {generating === type.id ? 'Generating...' : 'Generate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ==================== History Tab ==================== */}
        <TabsContent value="history" className="space-y-4">
          {reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No reports generated yet</p>
                <p className="text-muted-foreground mt-1">
                  Generate your first compliance report from the Generate tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <Card key={report.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{report.title}</h3>
                          <Badge className={reportTypeBadge(report.report_type)}>
                            {report.report_type.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(report.created_at)}
                          </span>
                          {report.date_range_start && (
                            <span>
                              Period: {formatDate(report.date_range_start)} — {formatDate(report.date_range_end)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            {report.status}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReport(report.id)}
                      >
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Selected Report Detail */}
          {selectedReport && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{selectedReport.title || 'Report Detail'}</CardTitle>
                <CardDescription>
                  Generated {formatDate(selectedReport.generated_at)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(selectedReport.sections || selectedReport, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== Export Tab ==================== */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Audit Trail
              </CardTitle>
              <CardDescription>
                Download the complete audit log for a date range as evidence for compliance audits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleExportAudit} disabled={exporting}>
                  {exporting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Compliance Posture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Shield className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                  <p className="text-2xl font-bold">TLS 1.2+</p>
                  <p className="text-xs text-muted-foreground">Encryption in Transit</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Lock className="w-6 h-6 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold">AES-256</p>
                  <p className="text-xs text-muted-foreground">Encryption at Rest</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Users className="w-6 h-6 mx-auto text-purple-600 mb-1" />
                  <p className="text-2xl font-bold">RBAC</p>
                  <p className="text-xs text-muted-foreground">Access Control</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <FileText className="w-6 h-6 mx-auto text-amber-600 mb-1" />
                  <p className="text-2xl font-bold">Full</p>
                  <p className="text-xs text-muted-foreground">Audit Trail</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
