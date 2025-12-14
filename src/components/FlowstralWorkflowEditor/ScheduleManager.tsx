/**
 * Schedule Manager - Schedule workflow/suite execution
 * Supports cron expressions, recurring schedules, and one-time runs
 */

import React, { useState, useEffect } from 'react';
import {
  Clock, Plus, Trash2, Edit2, Play, Pause, Calendar,
  CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { TestSuite } from './TestSuiteManager';

export interface Schedule {
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
  lastRun?: {
    timestamp: string;
    status: 'passed' | 'failed' | 'running';
    duration: number;
  };
  nextRun?: string;
  createdAt: string;
  notifyOnFailure: boolean;
  notifyEmail?: string;
}

interface ScheduleManagerProps {
  testSuites: TestSuite[];
  onRunSchedule?: (scheduleId: string) => void;
}

export default function ScheduleManager({ testSuites, onRunSchedule }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);

  const [newSchedule, setNewSchedule] = useState<Partial<Schedule>>({
    name: '',
    type: 'cron',
    cronExpression: '0 6 * * *',
    suiteId: '',
    environment: 'qa',
    enabled: true,
    notifyOnFailure: true,
  });

  // Preset cron expressions
  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at 6 AM', value: '0 6 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Weekdays at 8 AM', value: '0 8 * * 1-5' },
    { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
    { label: 'First day of month', value: '0 0 1 * *' },
  ];

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = () => {
    try {
      const saved = localStorage.getItem('test_schedules');
      if (saved) {
        setSchedules(JSON.parse(saved));
      } else {
        // Mock data
        setSchedules([
          {
            id: 'sched-1',
            name: 'Nightly Smoke Tests',
            type: 'cron',
            cronExpression: '0 2 * * *',
            suiteId: 'suite-1',
            suiteName: 'Smoke Tests',
            environment: 'qa',
            enabled: true,
            lastRun: {
              timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
              status: 'passed',
              duration: 45,
            },
            nextRun: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            notifyOnFailure: true,
            notifyEmail: 'qa-team@company.com',
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
            lastRun: {
              timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'failed',
              duration: 320,
            },
            nextRun: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            notifyOnFailure: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to load schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedules = (updatedSchedules: Schedule[]) => {
    setSchedules(updatedSchedules);
    localStorage.setItem('test_schedules', JSON.stringify(updatedSchedules));
  };

  const createSchedule = () => {
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
      createdAt: editingSchedule?.createdAt || new Date().toISOString(),
      notifyOnFailure: newSchedule.notifyOnFailure ?? true,
      notifyEmail: newSchedule.notifyEmail,
      nextRun: calculateNextRun(newSchedule),
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
    setNewSchedule({
      name: '',
      type: 'cron',
      cronExpression: '0 6 * * *',
      suiteId: '',
      environment: 'qa',
      enabled: true,
      notifyOnFailure: true,
    });
  };

  const calculateNextRun = (schedule: Partial<Schedule>): string => {
    const now = new Date();
    
    if (schedule.type === 'once' && schedule.oneTimeDate) {
      return schedule.oneTimeDate;
    }
    
    if (schedule.type === 'interval' && schedule.intervalMinutes) {
      return new Date(now.getTime() + schedule.intervalMinutes * 60 * 1000).toISOString();
    }
    
    // Simple cron calculation (just for display, actual execution would need proper parser)
    if (schedule.type === 'cron' && schedule.cronExpression) {
      // Just add 24 hours for demo
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    
    return now.toISOString();
  };

  const toggleSchedule = (scheduleId: string) => {
    saveSchedules(schedules.map(s => 
      s.id === scheduleId ? { ...s, enabled: !s.enabled } : s
    ));
    const schedule = schedules.find(s => s.id === scheduleId);
    toast.success(`Schedule ${schedule?.enabled ? 'disabled' : 'enabled'}`);
  };

  const deleteSchedule = (scheduleId: string) => {
    saveSchedules(schedules.filter(s => s.id !== scheduleId));
    toast.success('Schedule deleted');
  };

  const runNow = async (schedule: Schedule) => {
    // Update last run status
    const updatedSchedule = {
      ...schedule,
      lastRun: {
        timestamp: new Date().toISOString(),
        status: 'running' as const,
        duration: 0,
      },
    };
    saveSchedules(schedules.map(s => s.id === schedule.id ? updatedSchedule : s));
    
    // Simulate running
    onRunSchedule?.(schedule.id);
    toast.success(`Running ${schedule.name}...`);
    
    // Simulate completion after delay
    setTimeout(() => {
      const completed = {
        ...updatedSchedule,
        lastRun: {
          timestamp: new Date().toISOString(),
          status: Math.random() > 0.2 ? 'passed' : 'failed' as 'passed' | 'failed',
          duration: Math.floor(Math.random() * 120) + 30,
        },
        nextRun: calculateNextRun(schedule),
      };
      saveSchedules(schedules.map(s => s.id === schedule.id ? completed : s));
    }, 3000);
  };

  const formatNextRun = (date?: string) => {
    if (!date) return 'Not scheduled';
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    if (diff < 60 * 60 * 1000) return `In ${Math.round(diff / 60000)} minutes`;
    if (diff < 24 * 60 * 60 * 1000) return `In ${Math.round(diff / 3600000)} hours`;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Runs
        </h3>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Schedule
        </Button>
      </div>

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No schedules configured</p>
          <Button
            variant="link"
            onClick={() => setShowDialog(true)}
            className="mt-2"
          >
            Create your first schedule
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {schedules.map(schedule => (
            <Card key={schedule.id} className={!schedule.enabled ? 'opacity-60' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={() => toggleSchedule(schedule.id)}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{schedule.name}</span>
                        {getStatusBadge(schedule.lastRun?.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant="outline">{schedule.suiteName}</Badge>
                        <span>•</span>
                        <span>{schedule.environment}</span>
                        <span>•</span>
                        <code>{schedule.cronExpression || `Every ${schedule.intervalMinutes}min`}</code>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <div className="text-sm font-medium">{formatNextRun(schedule.nextRun)}</div>
                      {schedule.lastRun && (
                        <div className="text-xs text-muted-foreground">
                          Last: {new Date(schedule.lastRun.timestamp).toLocaleString()} ({schedule.lastRun.duration}s)
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runNow(schedule)}
                      disabled={schedule.lastRun?.status === 'running'}
                    >
                      {schedule.lastRun?.status === 'running' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSchedule(schedule);
                        setNewSchedule(schedule);
                        setShowDialog(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSchedule(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setEditingSchedule(null);
          setNewSchedule({
            name: '',
            type: 'cron',
            cronExpression: '0 6 * * *',
            suiteId: '',
            environment: 'qa',
            enabled: true,
            notifyOnFailure: true,
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Schedule Name</Label>
              <Input
                value={newSchedule.name || ''}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                placeholder="e.g., Nightly Smoke Tests"
              />
            </div>

            <div>
              <Label>Test Suite</Label>
              <Select
                value={newSchedule.suiteId || ''}
                onValueChange={(v) => setNewSchedule({ ...newSchedule, suiteId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select test suite" />
                </SelectTrigger>
                <SelectContent>
                  {testSuites.map(suite => (
                    <SelectItem key={suite.id} value={suite.id}>
                      {suite.name} ({suite.workflows.length} workflows)
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
                <SelectTrigger>
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
                    <SelectTrigger className="w-[180px]">
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
                  minute hour day month weekday
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
                />
              </div>
            )}

            <div>
              <Label>Environment</Label>
              <Select
                value={newSchedule.environment || 'qa'}
                onValueChange={(v) => setNewSchedule({ ...newSchedule, environment: v })}
              >
                <SelectTrigger>
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

            <div className="flex items-center space-x-2">
              <Switch
                checked={newSchedule.notifyOnFailure}
                onCheckedChange={(v) => setNewSchedule({ ...newSchedule, notifyOnFailure: v })}
              />
              <Label>Notify on failure</Label>
            </div>

            {newSchedule.notifyOnFailure && (
              <div>
                <Label>Notification Email</Label>
                <Input
                  type="email"
                  value={newSchedule.notifyEmail || ''}
                  onChange={(e) => setNewSchedule({ ...newSchedule, notifyEmail: e.target.value })}
                  placeholder="team@company.com"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createSchedule}>
              {editingSchedule ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

