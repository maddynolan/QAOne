/**
 * MobileTestRuns - Test Execution History & Reports
 * 
 * Features:
 * - Test run history with status, duration, pass/fail counts
 * - Pass rate analytics with visual charts
 * - Run detail view with step-by-step output
 * - Filter by status, platform, date range
 * - Bulk delete / export results
 * - Re-run failed tests
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMobileTestingStore, computeTestRunStats } from '@/stores/mobileTestingStore';
import type { MobileTestRun, TestRunStatus } from '@/stores/mobileTestingStore';
import { toast } from 'sonner';
import {
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Filter,
  Download,
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ChevronRight,
  X,
  RefreshCw,
  FileText,
  Apple,
  Bot,
  Search,
  Calendar,
} from 'lucide-react';

const STATUS_CONFIG: Record<TestRunStatus, { icon: React.ReactNode; color: string; label: string }> = {
  passed: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-500/10', label: 'Passed' },
  failed: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-500 bg-red-500/10', label: 'Failed' },
  running: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-sky-500 bg-sky-500/10', label: 'Running' },
  skipped: { icon: <AlertCircle className="w-4 h-4" />, color: 'text-gray-400 bg-gray-400/10', label: 'Skipped' },
  error: { icon: <XCircle className="w-4 h-4" />, color: 'text-amber-500 bg-amber-500/10', label: 'Error' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default function MobileTestRuns() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Individual selectors to prevent re-render loops
  const testRuns = useMobileTestingStore(s => s.testRuns);
  const clearTestRuns = useMobileTestingStore(s => s.clearTestRuns);
  const deleteTestRun = useMobileTestingStore(s => s.deleteTestRun);
  const stats = useMemo(() => computeTestRunStats(testRuns), [testRuns]);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TestRunStatus | 'all'>('all');
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'ios' | 'android'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRuns = useMemo(() => {
    let runs = [...testRuns];
    if (filterStatus !== 'all') runs = runs.filter(r => r.status === filterStatus);
    if (filterPlatform !== 'all') runs = runs.filter(r => r.platform === filterPlatform);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      runs = runs.filter(r => r.flow_name.toLowerCase().includes(q) || r.app_bundle_id.toLowerCase().includes(q));
    }
    return runs;
  }, [testRuns, filterStatus, filterPlatform, searchQuery]);

  const selectedRun = selectedRunId ? testRuns.find(r => r.id === selectedRunId) : null;

  const handleExport = () => {
    const data = JSON.stringify(filteredRuns, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mobile-test-runs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Test runs exported!');
  };

  return (
    <div className="space-y-6">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Runs', value: stats.total, icon: Activity, color: 'violet' },
          { label: 'Passed', value: stats.passed, icon: CheckCircle2, color: 'emerald' },
          { label: 'Failed', value: stats.failed, icon: XCircle, color: 'red' },
          { label: 'Pass Rate', value: `${stats.passRate}%`, icon: stats.passRate >= 80 ? TrendingUp : TrendingDown, color: stats.passRate >= 80 ? 'emerald' : 'amber' },
          { label: 'Avg Duration', value: formatDuration(stats.avgDuration), icon: Zap, color: 'sky' },
        ].map((stat, idx) => (
          <div key={idx} className={cn(
            "rounded-xl border p-4",
            isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className={cn("text-xs font-medium", isDark ? 'text-gray-400' : 'text-gray-500')}>{stat.label}</span>
              <stat.icon className={cn("w-4 h-4", `text-${stat.color}-500`)} />
            </div>
            <div className={cn("text-2xl font-bold", isDark ? 'text-white' : 'text-gray-900')}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Pass Rate Bar */}
      {stats.total > 0 && (
        <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <BarChart3 className="w-4 h-4" /> Pass Rate Distribution
            </h3>
          </div>
          <div className="flex h-6 rounded-lg overflow-hidden">
            {stats.passed > 0 && (
              <div
                className="bg-emerald-500 flex items-center justify-center text-white text-[10px] font-medium"
                style={{ width: `${(stats.passed / stats.total) * 100}%` }}
              >
                {stats.passed > 0 && `${stats.passed} passed`}
              </div>
            )}
            {stats.failed > 0 && (
              <div
                className="bg-red-500 flex items-center justify-center text-white text-[10px] font-medium"
                style={{ width: `${(stats.failed / stats.total) * 100}%` }}
              >
                {stats.failed > 0 && `${stats.failed} failed`}
              </div>
            )}
            {stats.errors > 0 && (
              <div
                className="bg-amber-500 flex items-center justify-center text-white text-[10px] font-medium"
                style={{ width: `${(stats.errors / stats.total) * 100}%` }}
              >
                {stats.errors > 0 && `${stats.errors} errors`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Runs List */}
      <div className="flex gap-6">
        {/* List */}
        <div className={cn(
          "flex-1 rounded-xl border flex flex-col",
          isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
        )}>
          {/* Filters */}
          <div className="p-4 border-b border-inherit">
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn("text-sm font-semibold", isDark ? 'text-white' : 'text-gray-900')}>Test Run History</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleExport} disabled={filteredRuns.length === 0}>
                  <Download className="w-3 h-3 mr-1" /> Export
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={() => { clearTestRuns(); setSelectedRunId(null); }}>
                  <Trash2 className="w-3 h-3 mr-1" /> Clear All
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search runs..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'passed', 'failed', 'error'] as const).map(s => (
                  <Button
                    key={s}
                    variant={filterStatus === s ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setFilterStatus(s)}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['all', 'ios', 'android'] as const).map(p => (
                  <Button
                    key={p}
                    variant={filterPlatform === p ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setFilterPlatform(p)}
                  >
                    {p === 'all' ? 'All' : p === 'ios' ? 'iOS' : 'Android'}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Run List */}
          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {filteredRuns.length > 0 ? (
              filteredRuns.map(run => {
                const statusCfg = STATUS_CONFIG[run.status];
                return (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 border-b border-inherit cursor-pointer transition-colors",
                      selectedRunId === run.id
                        ? isDark ? 'bg-violet-500/10' : 'bg-violet-50'
                        : isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", statusCfg.color)}>
                      {statusCfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium truncate", isDark ? 'text-white' : 'text-gray-900')}>
                          {run.flow_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                          {run.platform === 'ios' ? 'iOS' : 'Android'}
                        </Badge>
                      </div>
                      <div className={cn("text-xs flex items-center gap-3 mt-0.5", isDark ? 'text-gray-400' : 'text-gray-500')}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDuration(run.duration_ms)}
                        </span>
                        <span>{run.steps_passed}/{run.steps_total} steps</span>
                        <span>{new Date(run.started_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[10px]", statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTestRun(run.id); }}
                        className={cn("p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20", isDark ? 'text-red-400' : 'text-red-500')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={cn("text-center py-12 text-sm", isDark ? 'text-gray-500' : 'text-gray-400')}>
                <Activity className={cn("w-10 h-10 mx-auto mb-2", isDark ? 'text-gray-600' : 'text-gray-300')} />
                <p>{searchQuery || filterStatus !== 'all' ? 'No runs match your filters' : 'No test runs yet'}</p>
                <p className="text-xs mt-1">Run a test flow to see results here</p>
              </div>
            )}
          </div>
        </div>

        {/* Run Detail */}
        {selectedRun && (
          <div className={cn(
            "w-96 shrink-0 rounded-xl border",
            isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
          )}>
            <div className="p-4 border-b border-inherit">
              <div className="flex items-center justify-between">
                <h3 className={cn("text-sm font-semibold", isDark ? 'text-white' : 'text-gray-900')}>
                  Run Details
                </h3>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedRunId(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge className={cn("text-xs", STATUS_CONFIG[selectedRun.status].color)}>
                  {STATUS_CONFIG[selectedRun.status].label}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{selectedRun.platform === 'ios' ? 'iOS' : 'Android'}</Badge>
              </div>
            </div>

            <div className="p-4 space-y-3 text-xs">
              {[
                { label: 'Flow', value: selectedRun.flow_name },
                { label: 'Device', value: selectedRun.device },
                { label: 'Bundle ID', value: selectedRun.app_bundle_id },
                { label: 'Duration', value: formatDuration(selectedRun.duration_ms) },
                { label: 'Steps', value: `${selectedRun.steps_passed}/${selectedRun.steps_total} passed` },
                { label: 'Started', value: new Date(selectedRun.started_at).toLocaleString() },
                { label: 'Completed', value: selectedRun.completed_at ? new Date(selectedRun.completed_at).toLocaleString() : 'N/A' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className={cn(isDark ? 'text-gray-400' : 'text-gray-500')}>{item.label}</span>
                  <span className={cn("font-medium", isDark ? 'text-white' : 'text-gray-900')}>{item.value}</span>
                </div>
              ))}

              {selectedRun.error_message && (
                <div className={cn("p-3 rounded-lg mt-3", isDark ? 'bg-red-500/10' : 'bg-red-50')}>
                  <div className="flex items-center gap-1 mb-1 text-red-500 font-medium">
                    <XCircle className="w-3 h-3" /> Error
                  </div>
                  <p className={cn("text-[11px]", isDark ? 'text-red-400' : 'text-red-600')}>
                    {selectedRun.error_message}
                  </p>
                </div>
              )}

              {/* Output */}
              <div className="mt-3">
                <h4 className={cn("text-xs font-medium mb-2", isDark ? 'text-gray-400' : 'text-gray-600')}>Output</h4>
                <div className={cn("rounded-lg p-2 font-mono text-[10px] max-h-48 overflow-y-auto", isDark ? 'bg-gray-950 text-gray-300' : 'bg-gray-900 text-gray-300')}>
                  {selectedRun.output.map((line, idx) => (
                    <div key={idx} className="mb-0.5">{line}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
