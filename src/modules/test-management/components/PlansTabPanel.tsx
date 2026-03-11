/**
 * PlansTabPanel - Renders the Plans tab content in Test Repository.
 * Shows plan cards with status, linked suites/releases, test count, and actions.
 */
import React from 'react';
import {
  Target, FileText, Layers, Rocket, Play, Edit, Copy, Link2, Trash2,
  MoreVertical, Plus,
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
import type { TestPlan, TestSuite, Release, TestRun } from '../types/test-repository.types';

interface PlansTabPanelProps {
  plans: TestPlan[];
  suites: TestSuite[];
  releases: Release[];
  searchTerm: string;
  onCreatePlan: () => void;
  onEditPlan: (plan: TestPlan) => void;
  onLinkPlanToRelease: (plan: TestPlan) => void;
  onDuplicatePlan: (plan: TestPlan) => void;
  onDeletePlan: (planId: string) => void;
  onRunPlan: (plan: TestPlan) => void;
}

export function PlansTabPanel({
  plans,
  suites,
  releases,
  searchTerm,
  onCreatePlan,
  onEditPlan,
  onLinkPlanToRelease,
  onDuplicatePlan,
  onDeletePlan,
  onRunPlan,
}: PlansTabPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-5xl mx-auto">
        {/* Search results info */}
        {searchTerm.trim() && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <span className="text-blue-600 dark:text-primary">
              Found {plans.length} plans matching "{searchTerm}"
            </span>
          </div>
        )}
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm.trim() ? 'No Matching Plans' : 'No Test Plans'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm.trim() ? `No plans found matching "${searchTerm}"` : 'Create plans to organize test execution for releases'}
            </p>
            <Button
              onClick={onCreatePlan}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Test Plan
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => {
              const linkedSuites = suites.filter(s => plan.suiteIds.includes(s.id));
              const linkedRelease = releases.find(r => r.id === plan.releaseId);
              const totalTests = plan.testCaseIds.length + linkedSuites.reduce((acc, s) => acc + s.testCaseIds.length, 0);

              return (
                <Card key={plan.id} className="bg-secondary/50 border-border hover:border-blue-500/50 dark:hover:border-amber-500/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{plan.name}</h3>
                          <Badge className={cn(
                            "text-xs",
                            plan.status === 'draft' && "bg-gray-500/10 text-muted-foreground",
                            plan.status === 'ready' && "bg-blue-500/10 text-blue-400",
                            plan.status === 'in-progress' && "bg-amber-500/10 text-blue-600 dark:text-primary",
                            plan.status === 'completed' && "bg-green-500/10 text-green-400"
                          )}>
                            {plan.status}
                          </Badge>
                        </div>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <FileText className="w-3 h-3" />
                            {totalTests} tests
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Layers className="w-3 h-3" />
                            {plan.suiteIds.length} suites
                          </span>
                          {linkedRelease && (
                            <span className="flex items-center gap-1 text-purple-400">
                              <Rocket className="w-3 h-3" />
                              {linkedRelease.name}
                            </span>
                          )}
                          {plan.lastRun && (
                            <span className="text-muted-foreground">
                              Last run: {new Date(plan.lastRun.date).toLocaleDateString()}
                              <span className="ml-2 text-green-400">{plan.lastRun.passed}&#10003;</span>
                              <span className="ml-1 text-red-400">{plan.lastRun.failed}&#10007;</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => onRunPlan(plan)}
                          className="bg-green-600 hover:bg-green-500"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Run
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem
                              className="text-foreground focus:bg-secondary"
                              onClick={() => onEditPlan(plan)}
                            >
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-foreground focus:bg-secondary"
                              onClick={() => onLinkPlanToRelease(plan)}
                            >
                              <Link2 className="w-4 h-4 mr-2" /> Link to Release
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-foreground focus:bg-secondary"
                              onClick={() => onDuplicatePlan(plan)}
                            >
                              <Copy className="w-4 h-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-secondary" />
                            <DropdownMenuItem
                              className="text-red-400 focus:bg-red-500/10"
                              onClick={() => onDeletePlan(plan.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
