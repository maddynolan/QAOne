/**
 * DefectsTabPanel - Renders the Defects tab content in Test Repository.
 * Shows defect stats summary, defect list with severity/status badges, and actions.
 */
import React from 'react';
import {
  Bug, Plus, Users, Layers, Link2, Edit, ExternalLink, CheckCircle, Trash2, MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Defect, TestCase } from '../types/test-repository.types';
import { DEFECT_NEXT_STATUS } from '../constants/test-repository.constants';

interface DefectsTabPanelProps {
  defects: Defect[];
  testCases: TestCase[];
  onCreateDefect: () => void;
  onEditDefect: (defect: Defect) => void;
  onUpdateDefects: (updater: (prev: Defect[]) => Defect[]) => void;
  onNavigate: (path: string) => void;
}

export function DefectsTabPanel({
  defects,
  testCases,
  onCreateDefect,
  onEditDefect,
  onUpdateDefects,
  onNavigate,
}: DefectsTabPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-6xl mx-auto">
        {defects.length === 0 ? (
          <div className="text-center py-16">
            <Bug className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No Defects Found</h2>
            <p className="text-muted-foreground mb-6">Track bugs and issues linked to your test runs</p>
            <Button
              onClick={onCreateDefect}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Report First Defect
            </Button>
          </div>
        ) : (
          <div>
            {/* Defect Stats */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Total', count: defects.length, countClass: 'text-foreground', borderClass: 'border-border' },
                { label: 'Open', count: defects.filter(d => ['new', 'open', 'reopened'].includes(d.status)).length, countClass: 'text-red-600 dark:text-red-400', borderClass: 'border-red-500/30' },
                { label: 'In Progress', count: defects.filter(d => d.status === 'in-progress').length, countClass: 'text-amber-600 dark:text-amber-400', borderClass: 'border-amber-500/30' },
                { label: 'Fixed', count: defects.filter(d => ['fixed', 'verified'].includes(d.status)).length, countClass: 'text-blue-600 dark:text-blue-400', borderClass: 'border-blue-500/30' },
                { label: 'Closed', count: defects.filter(d => d.status === 'closed').length, countClass: 'text-green-600 dark:text-green-400', borderClass: 'border-green-500/30' },
              ].map(stat => (
                <Card key={stat.label} className={cn("bg-secondary", stat.borderClass)}>
                  <CardContent className="p-4 text-center">
                    <div className={cn("text-2xl font-bold", stat.countClass)}>{stat.count}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Defect List */}
            <div className="space-y-3">
              {defects.map((defect) => (
                <Card key={defect.id} className="bg-popover border-border hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn(
                            "text-xs",
                            defect.severity === 'critical' && "bg-red-500/20 text-red-400 border-red-500/50",
                            defect.severity === 'major' && "bg-orange-500/20 text-orange-400 border-orange-500/50",
                            defect.severity === 'minor' && "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
                            defect.severity === 'trivial' && "bg-gray-500/20 text-muted-foreground border-gray-500/50",
                          )}>
                            {defect.severity}
                          </Badge>
                          <Badge className={cn(
                            "text-xs",
                            defect.status === 'new' && "bg-purple-500/20 text-purple-400",
                            defect.status === 'open' && "bg-red-500/20 text-red-400",
                            defect.status === 'in-progress' && "bg-amber-500/20 text-blue-600 dark:text-primary",
                            defect.status === 'fixed' && "bg-blue-500/20 text-blue-400",
                            defect.status === 'verified' && "bg-cyan-500/20 text-cyan-400",
                            defect.status === 'closed' && "bg-green-500/20 text-green-400",
                            defect.status === 'reopened' && "bg-red-500/20 text-red-400",
                            defect.status === 'deferred' && "bg-gray-500/20 text-muted-foreground",
                          )}>
                            {defect.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{defect.id}</span>
                        </div>
                        <h3 className="font-medium text-foreground mb-1">{defect.title}</h3>
                        {defect.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{defect.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {defect.assignedTo && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {defect.assignedTo}
                            </span>
                          )}
                          {defect.component && (
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {defect.component}
                            </span>
                          )}
                          {defect.affectedVersion && (
                            <span>v{defect.affectedVersion}</span>
                          )}
                          <span>{new Date(defect.createdAt).toLocaleDateString()}</span>
                          {defect.linkedTestCaseIds && defect.linkedTestCaseIds.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-primary">
                              <Link2 className="w-3 h-3" />
                              {defect.linkedTestCaseIds.length} test(s)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className={cn(
                          "text-xs",
                          defect.priority === 'critical' && "bg-red-500/20 text-red-400",
                          defect.priority === 'high' && "bg-orange-500/20 text-orange-400",
                          defect.priority === 'medium' && "bg-yellow-500/20 text-yellow-400",
                          defect.priority === 'low' && "bg-green-500/20 text-green-400",
                        )}>
                          P: {defect.priority}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem
                              className="text-foreground focus:bg-secondary"
                              onClick={() => onEditDefect(defect)}
                            >
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-foreground focus:bg-secondary"
                              onClick={() => {
                                const nextStatus = DEFECT_NEXT_STATUS[defect.status] || 'open';
                                onUpdateDefects(prev => {
                                  const updated = prev.map(d => d.id === defect.id ? { ...d, status: nextStatus as any, updatedAt: new Date().toISOString() } : d);
                                  localStorage.setItem('test_defects', JSON.stringify(updated));
                                  return updated;
                                });
                                toast.success(`Status changed to ${nextStatus}`);
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" /> Move to Next Status
                            </DropdownMenuItem>
                            {defect.linkedTestCaseIds && defect.linkedTestCaseIds.length > 0 && (
                              <DropdownMenuItem
                                className="text-foreground focus:bg-secondary"
                                onClick={() => {
                                  const tc = testCases.find(t => defect.linkedTestCaseIds?.includes(t.id));
                                  if (tc) onNavigate(`/test-cases/builder?testCaseId=${tc.id}`);
                                }}
                              >
                                <ExternalLink className="w-4 h-4 mr-2" /> View Linked Test
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-secondary" />
                            <DropdownMenuItem
                              className="text-red-400 focus:bg-red-500/10"
                              onClick={() => {
                                if (!confirm('Delete this defect?')) return;
                                onUpdateDefects(prev => {
                                  const updated = prev.filter(d => d.id !== defect.id);
                                  localStorage.setItem('test_defects', JSON.stringify(updated));
                                  return updated;
                                });
                                toast.success('Defect deleted');
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
