/**
 * Quick filter chips component for ProjectManagement.
 */
import React from 'react';
import type { TeamMember } from '../../types/project-management-types';
import { TYPE_CONFIG, PRIORITY_CONFIG } from '../../constants/project-management-constants';
import { TeamAvatar } from './TeamAvatar';

export const QuickFilters: React.FC<{
  activeFilters: Record<string, string[]>;
  onFilterChange: (type: string, value: string) => void;
  teamMembers: TeamMember[];
}> = ({ activeFilters, onFilterChange, teamMembers }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg">
      {/* Type filters */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Type:</span>
        {Object.entries(TYPE_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => onFilterChange('type', key)}
            className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 transition-all
              ${activeFilters.type?.includes(key)
                ? `${config.color} text-white`
                : 'bg-muted hover:bg-muted/80'}`}
          >
            <span>{config.icon}</span>
            {config.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-2" />

      {/* Priority filters */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Priority:</span>
        {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => onFilterChange('priority', key)}
            className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 transition-all
              ${activeFilters.priority?.includes(key)
                ? config.color
                : 'bg-muted hover:bg-muted/80'}`}
          >
            <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
            {config.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-2" />

      {/* Team member filters */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Assignee:</span>
        {teamMembers.slice(0, 4).map(member => (
          <button
            key={member.id}
            onClick={() => onFilterChange('assignee', member.id)}
            className={`p-0.5 rounded-full transition-all
              ${activeFilters.assignee?.includes(member.id)
                ? 'ring-2 ring-primary ring-offset-2'
                : 'opacity-60 hover:opacity-100'}`}
          >
            <TeamAvatar member={member} size="sm" />
          </button>
        ))}
        <button
          onClick={() => onFilterChange('assignee', 'unassigned')}
          className={`px-2 py-1 rounded-full text-xs transition-all
            ${activeFilters.assignee?.includes('unassigned')
              ? 'bg-primary text-white'
              : 'bg-muted hover:bg-muted/80'}`}
        >
          Unassigned
        </button>
      </div>

      {/* Clear filters */}
      {Object.keys(activeFilters).length > 0 && (
        <>
          <div className="w-px h-6 bg-border mx-2" />
          <button
            onClick={() => onFilterChange('clear', '')}
            className="px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
};
