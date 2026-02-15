/**
 * Kanban column component for ProjectManagement board view.
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Issue, TeamMember, BoardColumn } from '../../types/project-management-types';
import { IssueCard } from './IssueCard';

export const KanbanColumn: React.FC<{
  column: BoardColumn;
  issues: Issue[];
  teamMembers: TeamMember[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: string) => void;
  onDragStart: (e: React.DragEvent, issue: Issue) => void;
  onIssueClick: (issue: Issue) => void;
  onAssign: (issueId: string, memberId: string) => void;
  onAddClick: (columnId: string) => void;
}> = ({ column, issues, teamMembers, onDragOver, onDrop, onDragStart, onIssueClick, onAssign, onAddClick }) => {
  const isOverWip = column.wipLimit && issues.length > column.wipLimit;

  return (
    <div
      className={`flex-1 min-w-[280px] max-w-[320px] rounded-xl p-3 transition-colors
        ${isOverWip ? 'bg-red-500/10 border border-red-500/30' : 'bg-muted/30'}`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="font-medium text-sm">{column.name}</span>
          <Badge variant={isOverWip ? "destructive" : "secondary"} className="text-xs">
            {issues.length}{column.wipLimit ? `/${column.wipLimit}` : ''}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-primary/10"
          onClick={() => onAddClick(column.id)}
          title={`Add item to ${column.name}`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Issues */}
      <div className="space-y-2 min-h-[200px]">
        {issues.map(issue => (
          <IssueCard
            key={issue.id}
            issue={issue}
            teamMembers={teamMembers}
            onDragStart={onDragStart}
            onClick={() => onIssueClick(issue)}
            onAssign={(memberId) => onAssign(issue.id, memberId)}
          />
        ))}
        {issues.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            Drop items here
          </div>
        )}
      </div>
    </div>
  );
};
