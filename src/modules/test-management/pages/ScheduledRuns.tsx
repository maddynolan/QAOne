/**
 * Scheduled Runs Page - Manage test execution schedules
 * Supports cron expressions, recurring schedules, and one-time runs
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Plus, Trash2, Edit2, Play, Pause, Calendar,
  CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw,
  Settings, Zap, Bell, BellOff, ChevronRight, MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';

// Types
interface Schedule {
  id: string;
  name: string;
  type: 'cron' | 'interval' | 'once';
  cronExpression?: string;
  intervalMinutes?: number;
  oneTimeDate?: string;
  suiteId: string;
  suiteName: string;
  environment: string;
  enabled: boolean;
  browser: 'chromium' | 'firefox' | 'webkit' | 'all';
  lastRun?: {
    timestamp: string;
    status: 'passed' | 'failed' | 'running';
    duration: number;
    passed: number;
    failed: number;
  };
  nextRun?: string;
  createdAt: string;
  notifyOnFailure: boolean;
  notifyEmail?: string;
  retryOnFailure: boolean;
  maxRetries: number;
}

interface TestSuite {
  id: string;
  name: string;
  environment: string;
  workflows: { id: string; name: string }[];
}

export default function ScheduledRuns() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  
  // Dialogs
  const [showDialog, setShowDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form state
  const [newSchedule, setNewSchedule] = useState<Partial<Schedule>>({
    name: '',
    type: 'cron',
    cronExpression: '0 6 * * *',
    suiteId: '',
    environment: 'qa',
    enabled: true,
    browser: 'chromium',
    notifyOnFailure: true,
    retryOnFailure: false,
    maxRetries: 2,
  });

  // Preset cron expressions
  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *', description: 'On the hour' },
    { label: 'Every 6 hours', value: '0 */6 * * *', description: '00:00, 06:00, 12:00, 18:00' },
    { label: 'Daily at 6 AM', value: '0 6 * * *', description: 'Every day at 6:00 AM' },
    { label: 'Daily at midnight', value: '0 0 * * *', description: 'Every day at 12:00 AM' },
    { label: 'Weekdays at 8 AM', value: '0 8 * * 1-5', description: 'Mon-Fri at 8:00 AM' },
    { label: 'Every Monday at 9 AM', value: '0 9 * * 1', description: 'Weekly on Monday' },
    { label: 'First day of month', value: '0 0 1 * *', description: 'Monthly at midnight' },
    { label: 'Every 30 minutes', value: '*/30 * * * *', description: 'At :00 and :30' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      // Load schedules
      const savedSchedules = localStorage.getItem('test_schedules');
      if (savedSchedules) {
        setSchedules(JSON.parse(savedSchedules));
      } else {
        // Default schedules
        const defaultSchedules: Schedule[] = [
          {
            id: 'sched-1',
            name: 'Nightly Smoke Tests',
            type: 'cron',
            cronExpression: '0 2 * * *',
            suiteId: 'suite-1',
            suiteName: 'Smoke Tests',
            environment: 'qa',
            enabled: true,
            browser: 'chromium',
            lastRun: {
              timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
              status: 'passed',
              duration: 45,
              passed: 5,
              failed: 0,
            },
            nextRun: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            notifyOnFailure: true,
            notifyEmail: 'qa-team@company.com',
            retryOnFailure: true,
            maxRetries: 2,
          },
          {
            id: 'sched-2',
            name: 'Weekly Regression',
            type: 'cron',
            cronExpression: '0 0 * * 0',
            suiteId: 'suite-2',
            suiteName: 'Regression Suite',
            environment: 'staging',
            enabled: true,
            browser: 'all',
            lastRun: {
              timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'failed',
              duration: 320,
              passed: 15,
              failed: 3,
            },
            nextRun: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            notifyOnFailure: true,
            retryOnFailure: false,
            maxRetries: 0,
          },
          {
            id: 'sched-3',
            name: 'Hourly Health Check',
            type: 'interval',
            intervalMinutes: 60,
            suiteId: 'suite-1',
            suiteName: 'Smoke Tests',
            environment: 'production',
            enabled: false,
            browser: 'chromium',
            nextRun: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            notifyOnFailure: true,
            notifyEmail: 'alerts@company.com',
            retryOnFailure: true,
            maxRetries: 3,
          },
        ];
        setSchedules(defaultSchedules);
        localStorage.setItem('test_schedules', JSON.stringify(defaultSchedules));
      }

      // Load test suites
      const savedSuites = localStorage.getItem('test_suites');
      if (savedSuites) {
        setTestSuites(JSON.parse(savedSuites));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const saveSchedules = (updatedSchedules: Schedule[]) => {
    setSchedules(updatedSchedules);
    localStorage.setItem('test_schedules', JSON.stringify(updatedSchedules));
  };

  const calculateNextRun = (schedule: Partial<Schedule>): string => {
    const now = new Date();
    
    if (schedule.type === 'once' && schedule.oneTimeDate) {
      return schedule.oneTimeDate;
    }
    
    if (schedule.type === 'interval' && schedule.intervalMinutes) {
      return new Date(now.getTime() + schedule.intervalMinutes * 60 * 1000).toISOString();
    }
    
    // Simple cron calculation (just for display)
    if (schedule.type === 'cron') {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    
    return now.toISOString();
  };

  const createOrUpdateSchedule = () => {
    if (!newSchedule.name?.trim() || !newSchedule.suiteId) {
      toast.error('Name and test suite are required');
      return;
    }

    const suite = testSuites.find(s => s.id === newSchedule.suiteId);
    
    const schedule: Schedule = {
      id: editingSchedule?.id || `sched-${Date.now()}`,
      name: newSchedule.name!,
      type: newSchedule.type as Schedule['type'],
      cronExpression: newSchedule.cronExpression,
      intervalMinutes: newSchedule.intervalMinutes,
      oneTimeDate: newSchedule.oneTimeDate,
      suiteId: newSchedule.suiteId!,
      suiteName: suite?.name || 'Unknown Suite',
      environment: newSchedule.environment || 'qa',
      enabled: newSchedule.enabled ?? true,
      browser: newSchedule.browser || 'chromium',
      createdAt: editingSchedule?.createdAt || new Date().toISOString(),
      notifyOnFailure: newSchedule.notifyOnFailure ?? true,
      notifyEmail: newSchedule.notifyEmail,
      retryOnFailure: newSchedule.retryOnFailure ?? false,
      maxRetries: newSchedule.maxRetries ?? 2,
      nextRun: calculateNextRun(newSchedule),
      lastRun: editingSchedule?.lastRun,
    };

    if (editingSchedule) {
      saveSchedules(schedules.map(s => s.id === editingSchedule.id ? schedule : s));
      toast.success('Schedule updated');
    } else {
      saveSchedules([...schedules, schedule]);
      toast.success('Schedule created');
    }

    setShowDialog(false);
    setEditingSchedule(null);
    resetForm();
  };

  const resetForm = () => {
    setNewSchedule({
      name: '',
      type: 'cron',
      cronExpression: '0 6 * * *',
      suiteId: '',
      environment: 'qa',
      enabled: true,
      browser: 'chromium',
      notifyOnFailure: true,
      retryOnFailure: false,
      maxRetries: 2,
    });
  };

  const toggleSchedule = (scheduleId: string) => {
    saveSchedules(schedules.map(s => 
      s.id === scheduleId ? { ...s, enabled: !s.enabled } : s
    ));
    const schedule = schedules.find(s => s.id === scheduleId);
    toast.success(`Schedule ${schedule?.enabled ? 'paused' : 'enabled'}`);
  };

  const deleteSchedule = (scheduleId: string) => {
    saveSchedules(schedules.filter(s => s.id !== scheduleId));
    toast.success('Schedule deleted');
  };

  const runNow = async (schedule: Schedule) => {
    // Update to running status
    saveSchedules(schedules.map(s => 
      s.id === schedule.id ? {
        ...s,
        lastRun: { timestamp: new Date().toISOString(), status: 'running' as const, duration: 0, passed: 0, failed: 0 },
      } : s
    ));
    
    toast.info(`Running ${schedule.name}...`);
    
    // Simulate execution
    setTimeout(() => {
      const passed = Math.floor(Math.random() * 10) + 1;
      const failed = Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;
      
      saveSchedules(schedules.map(s => 
        s.id === schedule.id ? {
          ...s,
          lastRun: {
            timestamp: new Date().toISOString(),
            status: failed > 0 ? 'failed' : 'passed',
            duration: Math.floor(Math.random() * 120) + 30,
            passed,
            failed,
          },
          nextRun: calculateNextRun(schedule),
        } : s
      ));
      
      if (failed > 0) {
        toast.error(`${schedule.name} completed with ${failed} failures`);
      } else {
        toast.success(`${schedule.name} completed successfully`);
      }
    }, 3000);
  };

  const formatNextRun = (date?: string) => {
    if (!date) return 'Not scheduled';
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    if (diff < 60 * 60 * 1000) return `In ${Math.round(diff / 60000)} min`;
    if (diff < 24 * 60 * 60 * 1000) return `In ${Math.round(diff / 3600000)} hours`;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getStatusBadge = (status?: 'passed' | 'failed' | 'running') => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Passed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      default:
        return <Badge variant="outline">Never run</Badge>;
    }
  };

  const getScheduleDescription = (schedule: Schedule) => {
    if (schedule.type === 'once' && schedule.oneTimeDate) {
      return `One-time: ${new Date(schedule.oneTimeDate).toLocaleString()}`;
    }
    if (schedule.type === 'interval' && schedule.intervalMinutes) {
      return `Every ${schedule.intervalMinutes} minutes`;
    }
    const preset = cronPresets.find(p => p.value === schedule.cronExpression);
    return preset?.description || schedule.cronExpression;
  };

  // Filter schedules
  const activeSchedules = schedules.filter(s => s.enabled);
  const pausedSchedules = schedules.filter(s => !s.enabled);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6 text-green-500" />
              Scheduled Runs
            </h1>
            <p className="text-muted-foreground mt-1">
              Automate your test execution with schedules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/test-suites')}>
              Manage Suites
            </Button>
            <Button onClick={() => { resetForm(); setShowDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Schedules</p>
                  <p className="text-2xl font-bold text-green-600">{activeSchedules.length}</p>
                </div>
                <Clock className="h-8 w-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paused</p>
                  <p className="text-2xl font-bold text-gray-500">{pausedSchedules.length}</p>
                </div>
                <Pause className="h-8 w-8 text-gray-400 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Passed (24h)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {schedules.filter(s => s.lastRun?.status === 'passed').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed (24h)</p>
                  <p className="text-2xl font-bold text-red-600">
                    {schedules.filter(s => s.lastRun?.status === 'failed').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Active ({activeSchedules.length})
            </TabsTrigger>
            <TabsTrigger value="paused" className="flex items-center gap-2">
              <Pause className="h-4 w-4" />
              Paused ({pausedSchedules.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              All ({schedules.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <ScheduleList 
              schedules={activeSchedules}
              onToggle={toggleSchedule}
              onEdit={(s) => { setEditingSchedule(s); setNewSchedule(s); setShowDialog(true); }}
              onDelete={deleteSchedule}
              onRunNow={runNow}
              formatNextRun={formatNextRun}
              getStatusBadge={getStatusBadge}
              getScheduleDescription={getScheduleDescription}
            />
          </TabsContent>

          <TabsContent value="paused" className="mt-4">
            <ScheduleList 
              schedules={pausedSchedules}
              onToggle={toggleSchedule}
              onEdit={(s) => { setEditingSchedule(s); setNewSchedule(s); setShowDialog(true); }}
              onDelete={deleteSchedule}
              onRunNow={runNow}
              formatNextRun={formatNextRun}
              getStatusBadge={getStatusBadge}
              getScheduleDescription={getScheduleDescription}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <ScheduleList 
              schedules={schedules}
              onToggle={toggleSchedule}
              onEdit={(s) => { setEditingSchedule(s); setNewSchedule(s); setShowDialog(true); }}
              onDelete={deleteSchedule}
              onRunNow={runNow}
              formatNextRun={formatNextRun}
              getStatusBadge={getStatusBadge}
              getScheduleDescription={getScheduleDescription}
            />
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) {
            setEditingSchedule(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label>Schedule Name</Label>
                <Input
                  value={newSchedule.name || ''}
                  onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                  placeholder="e.g., Nightly Smoke Tests"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Test Suite</Label>
                <Select
                  value={newSchedule.suiteId || ''}
                  onValueChange={(v) => setNewSchedule({ ...newSchedule, suiteId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select test suite" />
                  </SelectTrigger>
                  <SelectContent>
                    {testSuites.map(suite => (
                      <SelectItem key={suite.id} value={suite.id}>
                        {suite.name} ({suite.workflows?.length || 0} workflows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Schedule Type</Label>
                <Select
                  value={newSchedule.type || 'cron'}
                  onValueChange={(v) => setNewSchedule({ ...newSchedule, type: v as Schedule['type'] })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cron">Cron Expression</SelectItem>
                    <SelectItem value="interval">Fixed Interval</SelectItem>
                    <SelectItem value="once">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newSchedule.type === 'cron' && (
                <div className="space-y-2">
                  <Label>Cron Expression</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newSchedule.cronExpression || ''}
                      onChange={(e) => setNewSchedule({ ...newSchedule, cronExpression: e.target.value })}
                      placeholder="0 6 * * *"
                      className="font-mono"
                    />
                    <Select
                      value=""
                      onValueChange={(v) => setNewSchedule({ ...newSchedule, cronExpression: v })}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Presets" />
                      </SelectTrigger>
                      <SelectContent>
                        {cronPresets.map(preset => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    minute hour day month weekday • 
                    {cronPresets.find(p => p.value === newSchedule.cronExpression)?.description || 'Custom'}
                  </p>
                </div>
              )}

              {newSchedule.type === 'interval' && (
                <div>
                  <Label>Interval (minutes)</Label>
                  <Input
                    type="number"
                    value={newSchedule.intervalMinutes || 60}
                    onChange={(e) => setNewSchedule({ ...newSchedule, intervalMinutes: parseInt(e.target.value) })}
                    min={5}
                    max={1440}
                    className="mt-1"
                  />
                </div>
              )}

              {newSchedule.type === 'once' && (
                <div>
                  <Label>Run Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={newSchedule.oneTimeDate || ''}
                    onChange={(e) => setNewSchedule({ ...newSchedule, oneTimeDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Environment</Label>
                  <Select
                    value={newSchedule.environment || 'qa'}
                    onValueChange={(v) => setNewSchedule({ ...newSchedule, environment: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="qa">QA</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Browser</Label>
                  <Select
                    value={newSchedule.browser || 'chromium'}
                    onValueChange={(v) => setNewSchedule({ ...newSchedule, browser: v as Schedule['browser'] })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chromium">Chromium</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                      <SelectItem value="webkit">WebKit</SelectItem>
                      <SelectItem value="all">All Browsers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notify on failure
                  </Label>
                  <Switch
                    checked={newSchedule.notifyOnFailure}
                    onCheckedChange={(v) => setNewSchedule({ ...newSchedule, notifyOnFailure: v })}
                  />
                </div>

                {newSchedule.notifyOnFailure && (
                  <Input
                    type="email"
                    value={newSchedule.notifyEmail || ''}
                    onChange={(e) => setNewSchedule({ ...newSchedule, notifyEmail: e.target.value })}
                    placeholder="team@company.com"
                  />
                )}

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry on failure
                  </Label>
                  <Switch
                    checked={newSchedule.retryOnFailure}
                    onCheckedChange={(v) => setNewSchedule({ ...newSchedule, retryOnFailure: v })}
                  />
                </div>

                {newSchedule.retryOnFailure && (
                  <div className="flex items-center gap-2">
                    <Label>Max retries:</Label>
                    <Input
                      type="number"
                      value={newSchedule.maxRetries || 2}
                      onChange={(e) => setNewSchedule({ ...newSchedule, maxRetries: parseInt(e.target.value) })}
                      min={1}
                      max={5}
                      className="w-20"
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createOrUpdateSchedule}>
                {editingSchedule ? 'Update' : 'Create'} Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Schedule List Component
function ScheduleList({ 
  schedules, 
  onToggle, 
  onEdit, 
  onDelete, 
  onRunNow,
  formatNextRun,
  getStatusBadge,
  getScheduleDescription,
}: {
  schedules: Schedule[];
  onToggle: (id: string) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onRunNow: (schedule: Schedule) => void;
  formatNextRun: (date?: string) => string;
  getStatusBadge: (status?: 'passed' | 'failed' | 'running') => React.ReactNode;
  getScheduleDescription: (schedule: Schedule) => string;
}) {
  if (schedules.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
        <p className="text-muted-foreground">No schedules found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {schedules.map(schedule => (
        <Card key={schedule.id} className={!schedule.enabled ? 'opacity-60' : ''}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={() => onToggle(schedule.id)}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{schedule.name}</span>
                    {getStatusBadge(schedule.lastRun?.status)}
                    {schedule.notifyOnFailure && (
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Badge variant="outline">{schedule.suiteName}</Badge>
                    <span>•</span>
                    <span>{schedule.environment}</span>
                    <span>•</span>
                    <span className="font-mono text-xs">{getScheduleDescription(schedule)}</span>
                    <span>•</span>
                    <span>{schedule.browser}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">{formatNextRun(schedule.nextRun)}</div>
                  {schedule.lastRun && (
                    <div className="text-xs text-muted-foreground">
                      Last: {new Date(schedule.lastRun.timestamp).toLocaleDateString()} 
                      ({schedule.lastRun.duration}s)
                      {schedule.lastRun.passed > 0 && ` • ${schedule.lastRun.passed}✓`}
                      {schedule.lastRun.failed > 0 && ` • ${schedule.lastRun.failed}✗`}
                    </div>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRunNow(schedule)}
                  disabled={schedule.lastRun?.status === 'running'}
                >
                  {schedule.lastRun?.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Run Now
                    </>
                  )}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(schedule)}>
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggle(schedule.id)}>
                      {schedule.enabled ? (
                        <><Pause className="h-4 w-4 mr-2" /> Pause</>
                      ) : (
                        <><Play className="h-4 w-4 mr-2" /> Enable</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={() => onDelete(schedule.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

