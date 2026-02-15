/**
 * Issue card component for Kanban board in ProjectManagement.
 */
import React from 'react';
import { Link2, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import type { Issue, TeamMember } from '../../types/project-management-types';
import { TYPE_CONFIG, PRIORITY_CONFIG } from '../../constants/project-management-constants';
import { TeamAvatar } from './TeamAvatar';

export const IssueCard: React.FC<{
  issue: Issue;
  teamMembers: TeamMember[];
  onDragStart: (e: React.DragEvent, issue: Issue) => void;
  onClick: () => void;
  onAssign: (memberId: string) => void;
}> = ({ issue, teamMembers, onDragStart, onClick, onAssign }) => {
  const typeConfig = TYPE_CONFIG[issue.type];
  const priorityConfig = PRIORITY_CONFIG[issue.priority];
  const assignee = teamMembers.find(m => m.id === issue.assigneeId);

  const traceCount = issue.linkedRequirements.length + issue.linkedTestCases.length +
                     issue.linkedDefects.length + issue.linkedCommits.length;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, issue)}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer
                hover:border-primary/50 hover:shadow-md transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{typeConfig.icon}</span>
          <span className="text-xs text-muted-foreground font-mono">{issue.key}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${priorityConfig.dotColor}`} title={priorityConfig.label} />
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm mb-2 line-clamp-2">{issue.title}</h4>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {issue.labels.slice(0, 2).map(label => (
            <Badge key={label} variant="outline" className="text-xs py-0 px-1.5">
              {label}
            </Badge>
          ))}
          {issue.labels.length > 2 && (
            <Badge variant="outline" className="text-xs py-0 px-1.5">
              +{issue.labels.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {issue.points && (
            <span className="bg-muted px-1.5 py-0.5 rounded font-medium">
              {issue.points}
            </span>
          )}
          {traceCount > 0 && (
            <span className="flex items-center gap-1 text-primary">
              <Link2 className="w-3 h-3" />
              {traceCount}
            </span>
          )}
        </div>

        {/* Assignee with dropdown */}
        <Popover>
          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="hover:ring-2 hover:ring-primary rounded-full">
              <TeamAvatar member={assignee} size="sm" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">Assign to:</p>
              {teamMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => onAssign(member.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left
                    ${issue.assigneeId === member.id ? 'bg-primary/10' : ''}`}
                >
                  <TeamAvatar member={member} size="sm" />
                  <span className="text-sm">{member.name}</span>
                  {issue.assigneeId === member.id && <Check className="w-4 h-4 ml-auto text-primary" />}
                </button>
              ))}
              <button
                onClick={() => onAssign('')}
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left"
              >
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-3 h-3" />
                </div>
                <span className="text-sm text-muted-foreground">Unassign</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
