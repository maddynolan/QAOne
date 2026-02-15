/**
 * Team member avatar component for ProjectManagement.
 */
import React from 'react';
import { User } from 'lucide-react';
import type { TeamMember } from '../../types/project-management-types';

export const TeamAvatar: React.FC<{ member?: TeamMember; size?: 'sm' | 'md' | 'lg' }> = ({ member, size = 'md' }) => {
  const sizeClasses = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' };

  if (!member) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30`}>
        <User className="w-3 h-3 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-medium`}
      style={{ backgroundColor: member.color }}
      title={member.name}
    >
      {member.name.split(' ').map(n => n[0]).join('')}
    </div>
  );
};
