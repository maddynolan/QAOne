/**
 * Team panel sidebar component for ProjectManagement.
 */
import React from 'react';
import { Users, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeamMember, Issue } from '../../types/project-management-types';
import { TeamAvatar } from './TeamAvatar';

export const TeamPanel: React.FC<{
  members: TeamMember[];
  issues: Issue[];
  onAssign: (issueId: string, memberId: string) => void;
}> = ({ members, issues, onAssign }) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" />
          Team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map(member => {
          const memberIssues = issues.filter(i => i.assigneeId === member.id && i.status !== 'complete');
          const activeCount = memberIssues.filter(i => i.status === 'active').length;

          return (
            <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <TeamAvatar member={member} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{memberIssues.length}</p>
                <p className="text-xs text-muted-foreground">
                  {activeCount > 0 && <span className="text-amber-500">{activeCount} active</span>}
                </p>
              </div>
            </div>
          );
        })}

        {/* Unassigned count */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border-2 border-dashed">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Unassigned</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{issues.filter(i => !i.assigneeId).length}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
