/**
 * Type definitions for ProjectManagement page.
 */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  color: string;
}

export interface Issue {
  id: string;
  key: string;
  title: string;
  description: string;
  type: 'card' | 'action' | 'issue' | 'goal' | 'enhancement';
  status: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  assigneeId?: string;
  reporterId: string;
  cycleId?: string;
  goalId?: string;
  points?: number;
  labels: string[];
  created_at: string;
  updated_at: string;
  linkedRequirements: string[];
  linkedTestCases: string[];
  linkedDefects: string[];
  linkedCommits: string[];
}

export interface BoardColumn {
  id: string;
  name: string;
  color: string;
  wipLimit?: number;
  isDefault?: boolean;
}

export interface Cycle {
  id: string;
  name: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'complete';
  issueIds: string[];
}

export interface Goal {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  progress: number;
}

export interface StoredRequirement {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  source?: string;
}

export interface StoredTestCase {
  id: string;
  name: string;
  status?: string;
  linkedRequirements?: string[];
}

export interface StoredDefect {
  id: string;
  title: string;
  status?: string;
  severity?: string;
}
