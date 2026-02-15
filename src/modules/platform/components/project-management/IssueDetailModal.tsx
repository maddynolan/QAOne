/**
 * Issue detail modal for ProjectManagement.
 */
import React from 'react';
import { Link2, FileText, TestTube } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import type { Issue, TeamMember } from '../../types/project-management-types';
import { TYPE_CONFIG, PRIORITY_CONFIG } from '../../constants/project-management-constants';
import { TeamAvatar } from './TeamAvatar';

export const IssueDetailModal: React.FC<{
  issue: Issue | null;
  teamMembers: TeamMember[];
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Issue>) => void;
}> = ({ issue, teamMembers, open, onClose, onUpdate }) => {
  if (!issue) return null;

  const typeConfig = TYPE_CONFIG[issue.type];
  const assignee = teamMembers.find(m => m.id === issue.assigneeId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeConfig.icon}</span>
            <div>
              <span className="text-sm text-muted-foreground font-mono">{issue.key}</span>
              <DialogTitle className="text-xl">{issue.title}</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 mt-4">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">Description</Label>
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                {issue.description || 'No description provided.'}
              </div>
            </div>

            {/* Traceability */}
            <div>
              <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Traceability
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-sm">Requirements</span>
                      <Badge variant="secondary" className="ml-auto">{issue.linkedRequirements.length}</Badge>
                    </div>
                    {issue.linkedRequirements.length > 0 ? (
                      issue.linkedRequirements.map(req => (
                        <div key={req} className="text-xs bg-background rounded px-2 py-1 mb-1 font-mono">{req}</div>
                      ))
                    ) : <p className="text-xs text-muted-foreground">No links</p>}
                  </CardContent>
                </Card>

                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <TestTube className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-sm">Test Cases</span>
                      <Badge variant="secondary" className="ml-auto">{issue.linkedTestCases.length}</Badge>
                    </div>
                    {issue.linkedTestCases.length > 0 ? (
                      issue.linkedTestCases.map(tc => (
                        <div key={tc} className="text-xs bg-background rounded px-2 py-1 mb-1 font-mono">{tc}</div>
                      ))
                    ) : <p className="text-xs text-muted-foreground">No links</p>}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Assignee</Label>
              <Select value={issue.assigneeId || 'unassigned'} onValueChange={(v) => onUpdate({ assigneeId: v === 'unassigned' ? undefined : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <TeamAvatar member={m} size="sm" />
                        {m.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
              <Select value={issue.priority} onValueChange={(v) => onUpdate({ priority: v as Issue['priority'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Points</Label>
              <div className="p-2 border rounded-md text-sm font-medium">
                {issue.points || '\u2014'}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Labels</Label>
              <div className="flex flex-wrap gap-1">
                {issue.labels.map(label => (
                  <Badge key={label} variant="outline" className="text-xs">{label}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
