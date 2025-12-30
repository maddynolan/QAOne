import React, { useState, useCallback, useEffect } from 'react';
import { 
  LayoutGrid, List, GitBranch, Target, Calendar, Users, 
  Plus, Search, Filter, MoreHorizontal, ChevronDown, ChevronUp,
  CheckCircle2, Circle, Clock, AlertCircle, XCircle,
  Link2, TestTube, Bug, FileText, Zap, ArrowRight,
  Sparkles, TrendingUp, BarChart3, Eye, Edit, Trash2,
  GripVertical, Tag, User, CalendarDays, Flag, Settings,
  UserPlus, X, Check, Columns, RefreshCw, Palette,
  ChevronRight, Play, Pause, Archive, FileCode, Copy, Download,
  Loader2, BookText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

// ==================== TYPES ====================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  color: string;
}

interface Issue {
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

interface BoardColumn {
  id: string;
  name: string;
  color: string;
  wipLimit?: number;
  isDefault?: boolean;
}

interface Cycle {
  id: string;
  name: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'complete';
  issueIds: string[];
}

interface Goal {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  progress: number;
}

// ==================== MOCK DATA ====================

const TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Alex Chen', email: 'alex@company.com', role: 'Lead Developer', color: '#6366f1' },
  { id: '2', name: 'Sarah Miller', email: 'sarah@company.com', role: 'QA Engineer', color: '#ec4899' },
  { id: '3', name: 'Mike Johnson', email: 'mike@company.com', role: 'Backend Dev', color: '#22c55e' },
  { id: '4', name: 'Emma Wilson', email: 'emma@company.com', role: 'Frontend Dev', color: '#f59e0b' },
  { id: '5', name: 'James Brown', email: 'james@company.com', role: 'DevOps', color: '#06b6d4' },
];

const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'queue', name: 'Queue', color: '#64748b', isDefault: true },
  { id: 'ready', name: 'Ready', color: '#3b82f6' },
  { id: 'in_progress', name: 'In Progress', color: '#f59e0b' },
  { id: 'review', name: 'Review', color: '#8b5cf6' },
  { id: 'ready_to_test', name: 'Ready to Test', color: '#06b6d4' },
  { id: 'testing', name: 'Testing', color: '#ec4899' },
  { id: 'done', name: 'Done', color: '#22c55e' },
];

const MOCK_ISSUES: Issue[] = [
  {
    id: '1', key: 'AT-101', title: 'User authentication flow', description: 'Implement OAuth2 login',
    type: 'card', status: 'in_progress', priority: 'high', assigneeId: '1', reporterId: '2',
    cycleId: '1', goalId: '1', points: 8, labels: ['auth', 'security'],
    created_at: '2025-12-01', updated_at: '2025-12-10',
    linkedRequirements: ['REQ-001', 'REQ-002'], linkedTestCases: ['TC-101', 'TC-102'],
    linkedDefects: [], linkedCommits: ['abc123']
  },
  {
    id: '2', key: 'AT-102', title: 'Dashboard performance', description: 'Reduce load time',
    type: 'action', status: 'ready', priority: 'normal', assigneeId: '3', reporterId: '1',
    cycleId: '1', points: 5, labels: ['performance'],
    created_at: '2025-12-02', updated_at: '2025-12-09',
    linkedRequirements: ['REQ-003'], linkedTestCases: ['TC-201'], linkedDefects: ['BUG-001'], linkedCommits: []
  },
  {
    id: '3', key: 'AT-103', title: 'Login button not responding', description: 'Mobile Safari issue',
    type: 'issue', status: 'testing', priority: 'urgent', assigneeId: '2', reporterId: '4',
    cycleId: '1', points: 3, labels: ['mobile', 'urgent'],
    created_at: '2025-12-08', updated_at: '2025-12-11',
    linkedRequirements: [], linkedTestCases: ['TC-101'], linkedDefects: [], linkedCommits: ['ghi789']
  },
  {
    id: '4', key: 'AT-104', title: 'API rate limiting', description: 'Implement rate limits',
    type: 'enhancement', status: 'queue', priority: 'normal', reporterId: '1',
    points: 13, labels: ['api', 'security'],
    created_at: '2025-12-05', updated_at: '2025-12-05',
    linkedRequirements: ['REQ-010'], linkedTestCases: [], linkedDefects: [], linkedCommits: []
  },
  {
    id: '5', key: 'AT-105', title: 'User profile redesign', description: 'Modern profile page',
    type: 'goal', status: 'review', priority: 'low', assigneeId: '4', reporterId: '1',
    points: 21, labels: ['design', 'ux'],
    created_at: '2025-11-20', updated_at: '2025-12-10',
    linkedRequirements: ['REQ-020'], linkedTestCases: [], linkedDefects: [], linkedCommits: []
  },
  {
    id: '6', key: 'AT-106', title: 'Export reports to PDF', description: 'PDF export feature',
    type: 'card', status: 'done', priority: 'normal', assigneeId: '1', reporterId: '2',
    cycleId: '2', points: 5, labels: ['reports'],
    created_at: '2025-11-25', updated_at: '2025-12-05',
    linkedRequirements: ['REQ-015'], linkedTestCases: ['TC-301'], linkedDefects: [], linkedCommits: ['jkl012']
  },
  {
    id: '7', key: 'AT-107', title: 'Database connection pooling', description: 'Optimize DB',
    type: 'action', status: 'ready_to_test', priority: 'high', assigneeId: '3', reporterId: '5',
    cycleId: '1', points: 8, labels: ['backend'],
    created_at: '2025-12-06', updated_at: '2025-12-06',
    linkedRequirements: [], linkedTestCases: [], linkedDefects: ['BUG-002'], linkedCommits: []
  },
  {
    id: '8', key: 'AT-108', title: 'Mobile responsive tables', description: 'Mobile tables',
    type: 'card', status: 'queue', priority: 'low', reporterId: '4',
    points: 5, labels: ['mobile', 'ux'],
    created_at: '2025-12-07', updated_at: '2025-12-07',
    linkedRequirements: ['REQ-025'], linkedTestCases: [], linkedDefects: [], linkedCommits: []
  },
];

const MOCK_CYCLES: Cycle[] = [
  { id: '1', name: 'Cycle 23', objective: 'Complete authentication', startDate: '2025-12-09', endDate: '2025-12-23', status: 'active', issueIds: ['1', '2', '3', '7'] },
  { id: '2', name: 'Cycle 22', objective: 'Reporting features', startDate: '2025-11-25', endDate: '2025-12-08', status: 'complete', issueIds: ['6'] },
  { id: '3', name: 'Cycle 24', objective: 'API enhancements', startDate: '2025-12-23', endDate: '2026-01-06', status: 'planning', issueIds: [] },
];

const MOCK_GOALS: Goal[] = [
  { id: '1', key: 'GOAL-1', name: 'Authentication System', description: 'Complete auth module', color: '#6366f1', progress: 65 },
  { id: '2', key: 'GOAL-2', name: 'Performance Optimization', description: 'Speed improvements', color: '#22c55e', progress: 30 },
];

// ==================== CONSTANTS ====================

const TYPE_CONFIG = {
  goal: { label: 'Goal', color: 'bg-purple-600', icon: '🎯', description: 'Large objective' },
  enhancement: { label: 'Enhancement', color: 'bg-green-600', icon: '✨', description: 'New capability' },
  card: { label: 'Card', color: 'bg-blue-600', icon: '📋', description: 'Work item' },
  action: { label: 'Action', color: 'bg-cyan-600', icon: '⚡', description: 'Task to complete' },
  issue: { label: 'Issue', color: 'bg-red-600', icon: '🔴', description: 'Problem to fix' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-600 text-white', icon: '🔥', dotColor: 'bg-red-500' },
  high: { label: 'High', color: 'bg-orange-500 text-white', icon: '⬆️', dotColor: 'bg-orange-500' },
  normal: { label: 'Normal', color: 'bg-blue-500 text-white', icon: '➡️', dotColor: 'bg-blue-500' },
  low: { label: 'Low', color: 'bg-slate-400 text-white', icon: '⬇️', dotColor: 'bg-slate-400' },
};

// ==================== COMPONENTS ====================

// Team Member Avatar
const TeamAvatar: React.FC<{ member?: TeamMember; size?: 'sm' | 'md' | 'lg' }> = ({ member, size = 'md' }) => {
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

// Quick Filter Chips
const QuickFilters: React.FC<{
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

// Team Panel Component
const TeamPanel: React.FC<{
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

// Column Customization Dialog
const ColumnCustomizer: React.FC<{
  columns: BoardColumn[];
  onSave: (columns: BoardColumn[]) => void;
  open: boolean;
  onClose: () => void;
}> = ({ columns, onSave, open, onClose }) => {
  const [editedColumns, setEditedColumns] = useState<BoardColumn[]>(columns);
  const [newColumnName, setNewColumnName] = useState('');
  
  const addColumn = () => {
    if (!newColumnName.trim()) return;
    const newCol: BoardColumn = {
      id: newColumnName.toLowerCase().replace(/\s+/g, '_'),
      name: newColumnName,
      color: '#6366f1',
    };
    setEditedColumns([...editedColumns, newCol]);
    setNewColumnName('');
  };
  
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const removeColumn = (id: string) => {
    setEditedColumns(editedColumns.filter(c => c.id !== id));
  };
  
  const updateColumn = (id: string, updates: Partial<BoardColumn>) => {
    setEditedColumns(editedColumns.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedCol(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (colId !== draggedCol) setDragOverCol(colId);
  };

  const handleColDragEnd = () => {
    if (draggedCol && dragOverCol && draggedCol !== dragOverCol) {
      const cols = [...editedColumns];
      const dragIdx = cols.findIndex(c => c.id === draggedCol);
      const dropIdx = cols.findIndex(c => c.id === dragOverCol);
      if (dragIdx !== -1 && dropIdx !== -1) {
        const [removed] = cols.splice(dragIdx, 1);
        cols.splice(dropIdx, 0, removed);
        setEditedColumns(cols);
      }
    }
    setDraggedCol(null);
    setDragOverCol(null);
  };
  
  const colors = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#64748b'];
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns className="w-5 h-5" />
            Customize Columns
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Existing columns */}
          <div className="space-y-2">
            {editedColumns.map((col, index) => (
              <div 
                key={col.id} 
                draggable
                onDragStart={(e) => handleColDragStart(e, col.id)}
                onDragOver={(e) => handleColDragOver(e, col.id)}
                onDragEnd={handleColDragEnd}
                onDragLeave={() => setDragOverCol(null)}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-move transition-all ${
                  draggedCol === col.id ? 'opacity-50 bg-primary/20 border border-primary' :
                  dragOverCol === col.id ? 'bg-primary/10 border border-dashed border-primary' :
                  'bg-muted/50 hover:bg-muted'
                }`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div 
                  className="w-4 h-4 rounded-full cursor-pointer"
                  style={{ backgroundColor: col.color }}
                />
                <Input 
                  value={col.name}
                  onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                  className="flex-1 h-8"
                />
                <Input 
                  type="number"
                  placeholder="WIP"
                  value={col.wipLimit || ''}
                  onChange={(e) => updateColumn(col.id, { wipLimit: parseInt(e.target.value) || undefined })}
                  className="w-16 h-8"
                />
                {!col.isDefault && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeColumn(col.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          {/* Add new column */}
          <div className="flex items-center gap-2">
            <Input 
              placeholder="New column name..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addColumn()}
            />
            <Button onClick={addColumn} disabled={!newColumnName.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(editedColumns); onClose(); }}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Issue Card Component
const IssueCard: React.FC<{ 
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

// Kanban Column Component
const KanbanColumn: React.FC<{
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

// Create Issue Modal
const CreateIssueModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreate: (issue: Partial<Issue>) => void;
  teamMembers: TeamMember[];
  columns: BoardColumn[];
  defaultColumn?: string;
}> = ({ open, onClose, onCreate, teamMembers, columns, defaultColumn = 'queue' }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('card');
  const [priority, setPriority] = useState('normal');
  const [assigneeId, setAssigneeId] = useState('none');
  const [status, setStatus] = useState(defaultColumn);
  const [points, setPoints] = useState('none');
  const [labels, setLabels] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setType('card');
      setPriority('normal');
      setAssigneeId('none');
      setStatus(defaultColumn);
      setPoints('none');
      setLabels('');
    }
  }, [open, defaultColumn]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const newIssue: Partial<Issue> = {
        title: title.trim(),
        description: description.trim(),
        type: type as Issue['type'],
        priority: priority as Issue['priority'],
        status,
        assigneeId: assigneeId === 'none' ? undefined : assigneeId,
        points: points === 'none' ? undefined : parseInt(points),
        labels: labels.split(',').map(l => l.trim()).filter(Boolean),
        linkedRequirements: [],
        linkedTestCases: [],
        linkedDefects: [],
        linkedCommits: [],
      };
      
      await onCreate(newIssue);
      onClose();
    } catch (error) {
      console.error('Failed to create item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Add more details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="issue">Issue</SelectItem>
                  <SelectItem value="goal">Goal</SelectItem>
                  <SelectItem value="enhancement">Enhancement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status & Assignee Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Points & Labels Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Points</Label>
              <Select value={points} onValueChange={setPoints}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No estimate</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="13">13</SelectItem>
                  <SelectItem value="21">21</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Labels</Label>
              <Input
                placeholder="frontend, urgent"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? 'Creating...' : 'Create Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Issue Detail Modal (simplified for brevity - keeping the traceability part)
const IssueDetailModal: React.FC<{
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
                {issue.points || '—'}
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

// ==================== MAIN COMPONENT ====================

// Types for traceability
interface StoredRequirement {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  source?: string;
}

interface StoredTestCase {
  id: string;
  name: string;
  status?: string;
  linkedRequirements?: string[];
}

interface StoredDefect {
  id: string;
  title: string;
  status?: string;
  severity?: string;
}

export default function ProjectManagement() {
  const [issues, setIssues] = useState<Issue[]>(MOCK_ISSUES);
  const [cycles] = useState<Cycle[]>(MOCK_CYCLES);
  const [columns, setColumns] = useState<BoardColumn[]>(DEFAULT_COLUMNS);
  const [teamMembers] = useState<TeamMember[]>(TEAM_MEMBERS);
  
  // Traceability data from localStorage
  const [storedRequirements, setStoredRequirements] = useState<StoredRequirement[]>([]);
  const [storedTestCases, setStoredTestCases] = useState<StoredTestCase[]>([]);
  const [storedDefects, setStoredDefects] = useState<StoredDefect[]>([]);
  
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [columnCustomizerOpen, setColumnCustomizerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultColumn, setCreateDefaultColumn] = useState('queue');
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [draggedIssue, setDraggedIssue] = useState<Issue | null>(null);

  // Gherkin state
  const [gherkinLoading, setGherkinLoading] = useState(false);
  const [generatedGherkin, setGeneratedGherkin] = useState<string>('');
  const [selectedIssueForGherkin, setSelectedIssueForGherkin] = useState<string>('');
  const [gherkinTemplate, setGherkinTemplate] = useState<string>('default');
  const [requirementText, setRequirementText] = useState<string>('');

  // Gherkin templates
  const GHERKIN_TEMPLATES = {
    default: {
      name: 'Default BDD',
      description: 'Standard Gherkin format with Given/When/Then',
      template: `Feature: {{feature_name}}
  As a {{user_type}}
  I want to {{action}}
  So that {{benefit}}

  Background:
    Given I am a {{user_type}}

  Scenario: {{scenario_name}}
    Given {{precondition}}
    When {{action}}
    Then {{expected_result}}`
    },
    api_testing: {
      name: 'API Testing',
      description: 'For REST API endpoint testing',
      template: `Feature: {{endpoint_name}} API
  As an API consumer
  I want to interact with {{endpoint_name}}
  So that I can {{benefit}}

  Background:
    Given the API server is running
    And I have valid authentication

  Scenario: Successful {{operation}}
    Given the request body is valid
    When I send a {{method}} request to "{{path}}"
    Then the response status code should be {{status}}
    And the response should contain {{expected_field}}`
    },
    user_story: {
      name: 'User Story',
      description: 'User story focused scenarios',
      template: `Feature: {{story_title}}
  As a {{persona}}
  I want to {{goal}}
  So that {{value}}

  Scenario: Happy path - {{success_scenario}}
    Given I am on the {{page}}
    When I {{action}}
    Then I should see {{result}}

  Scenario: Error handling - {{error_scenario}}
    Given I am on the {{page}}
    When I {{invalid_action}}
    Then I should see an error message "{{error_message}}"`
    },
    e2e_flow: {
      name: 'E2E Flow',
      description: 'End-to-end user journey testing',
      template: `Feature: {{journey_name}}
  Complete user journey for {{process}}

  Background:
    Given the application is accessible
    And test data is prepared

  Scenario Outline: {{scenario_outline}}
    Given I am logged in as "<user_type>"
    When I navigate to "<page>"
    And I perform "<action>"
    Then I should see "<expected_outcome>"

    Examples:
      | user_type | page | action | expected_outcome |
      | admin | dashboard | view reports | analytics displayed |
      | user | profile | update settings | confirmation message |`
    },
    data_driven: {
      name: 'Data-Driven',
      description: 'Parameterized testing with examples',
      template: `Feature: {{feature_name}}
  Data-driven tests for {{component}}

  Scenario Outline: {{test_name}} with various inputs
    Given the system is in state "<initial_state>"
    When I input "<input_value>"
    And I submit the form
    Then the result should be "<expected_result>"
    And the system state should be "<final_state>"

    Examples:
      | initial_state | input_value | expected_result | final_state |
      | empty | valid data | success | populated |
      | existing | duplicate | error | unchanged |
      | empty | invalid | validation error | empty |`
    }
  };

  // API Base URL
  const API_BASE = 'http://localhost:8000/api/projects';
  const GHERKIN_API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Load issues from backend
  const loadIssues = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/issues?limit=100`);
      if (response.ok) {
        const data = await response.json();
        if (data.issues && data.issues.length > 0) {
          // Map backend format to frontend format
          const mappedIssues = data.issues.map((i: any) => ({
            id: i.id,
            key: i.key,
            title: i.title,
            description: i.description || '',
            type: i.type || 'card',
            status: i.status || 'queue',
            priority: i.priority || 'normal',
            assigneeId: i.assignee_id || i.assigneeId,
            reporterId: i.reporter_id || i.reporterId || '1',
            cycleId: i.cycle_id || i.cycleId,
            goalId: i.goal_id || i.goalId,
            points: i.story_points || i.points,
            labels: i.labels || [],
            created_at: i.created_at || '',
            updated_at: i.updated_at || '',
            linkedRequirements: i.linked_requirements || i.linkedRequirements || [],
            linkedTestCases: i.linked_test_cases || i.linkedTestCases || [],
            linkedDefects: i.linked_defects || i.linkedDefects || [],
            linkedCommits: i.linked_commits || i.linkedCommits || [],
          }));
          setIssues(mappedIssues);
        }
      }
    } catch (error) {
      console.error('Failed to load issues:', error);
      // Keep mock data if API fails
    } finally {
      setIsLoading(false);
    }
  };

  // Create new issue
  const handleCreateIssue = async (newIssue: Partial<Issue>) => {
    try {
      const response = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newIssue.title,
          description: newIssue.description,
          type: newIssue.type,
          priority: newIssue.priority,
          assignee: teamMembers.find(m => m.id === newIssue.assigneeId)?.name,
          story_points: newIssue.points,
          labels: newIssue.labels,
          linked_requirements: newIssue.linkedRequirements || [],
          linked_test_cases: newIssue.linkedTestCases || [],
          linked_defects: newIssue.linkedDefects || [],
          linked_commits: newIssue.linkedCommits || [],
        }),
      });

      if (response.ok) {
        const createdIssue = await response.json();
        
        // Add to local state with proper mapping
        const mappedIssue: Issue = {
          id: createdIssue.id,
          key: createdIssue.key,
          title: createdIssue.title,
          description: createdIssue.description || '',
          type: createdIssue.type || 'card',
          status: newIssue.status || 'queue',
          priority: createdIssue.priority || 'normal',
          assigneeId: newIssue.assigneeId,
          reporterId: '1',
          points: createdIssue.story_points,
          labels: createdIssue.labels || [],
          created_at: createdIssue.created_at,
          updated_at: createdIssue.updated_at,
          linkedRequirements: createdIssue.linked_requirements || [],
          linkedTestCases: createdIssue.linked_test_cases || [],
          linkedDefects: createdIssue.linked_defects || [],
          linkedCommits: createdIssue.linked_commits || [],
        };

        // Update the status if specified
        if (newIssue.status && newIssue.status !== 'queue') {
          await fetch(`${API_BASE}/issues/${createdIssue.id}/move?new_status=${newIssue.status}`, {
            method: 'POST',
          });
          mappedIssue.status = newIssue.status;
        }

        setIssues(prev => [mappedIssue, ...prev]);
        toast.success(`Created ${mappedIssue.key}: ${mappedIssue.title}`);
      } else {
        throw new Error('Failed to create issue');
      }
    } catch (error) {
      console.error('Failed to create issue:', error);
      toast.error('Failed to create item');
      throw error;
    }
  };

  // Load traceability data from localStorage and API
  const loadTraceabilityData = useCallback(async () => {
    // Load requirements
    const reqStored = JSON.parse(localStorage.getItem('requirements') || '[]');
    let allReqs = reqStored;
    try {
      const reqRes = await fetch('http://localhost:8000/requirements');
      if (reqRes.ok) {
        const data = await reqRes.json();
        const apiReqs = (data.requirements || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          priority: r.priority,
          status: r.status,
          source: r.source,
        }));
        // Merge and dedupe
        const ids = new Set(reqStored.map((r: any) => r.id));
        allReqs = [...reqStored, ...apiReqs.filter((r: any) => !ids.has(r.id))];
      }
    } catch (e) { /* ignore */ }
    setStoredRequirements(allReqs);

    // Load test cases
    const tcStored = JSON.parse(localStorage.getItem('test_cases') || '[]');
    let allTcs = tcStored;
    try {
      const tcRes = await fetch('http://localhost:8000/test-cases');
      if (tcRes.ok) {
        const data = await tcRes.json();
        const apiTcs = (data.testCases || []).map((t: any) => ({
          id: t.id,
          name: t.name || t.title,
          status: t.status,
          linkedRequirements: t.linkedRequirements || t.linked_requirements || [],
        }));
        const ids = new Set(tcStored.map((t: any) => t.id));
        allTcs = [...tcStored, ...apiTcs.filter((t: any) => !ids.has(t.id))];
      }
    } catch (e) { /* ignore */ }
    setStoredTestCases(allTcs);

    // Load defects
    const defStored = JSON.parse(localStorage.getItem('defects') || '[]');
    let allDefs = defStored;
    try {
      const defRes = await fetch('http://localhost:8000/defects');
      if (defRes.ok) {
        const data = await defRes.json();
        const apiDefs = (data.defects || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          severity: d.severity,
        }));
        const ids = new Set(defStored.map((d: any) => d.id));
        allDefs = [...defStored, ...apiDefs.filter((d: any) => !ids.has(d.id))];
      }
    } catch (e) { /* ignore */ }
    setStoredDefects(allDefs);
  }, []);

  // Load issues on mount
  useEffect(() => {
    loadIssues();
    loadTraceabilityData();
  }, [loadTraceabilityData]);

  // Gherkin conversion from issue
  const handleConvertIssueToGherkin = async (issueId: string) => {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) {
      toast.error('Issue not found');
      return;
    }

    setGherkinLoading(true);
    setSelectedIssueForGherkin(issueId);
    
    try {
      const response = await fetch(`${GHERKIN_API}/api/gherkin/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: {
            id: issue.id,
            title: issue.title,
            description: issue.description,
            type: issue.type,
            source: 'project_management'
          },
          include_background: true,
          include_scenarios: true,
          max_scenarios: 5
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedGherkin(data.gherkin || generateLocalGherkin(issue));
        toast.success('Gherkin generated successfully');
      } else {
        // Fallback to local generation
        setGeneratedGherkin(generateLocalGherkin(issue));
        toast.success('Gherkin generated (local)');
      }
    } catch (error) {
      console.error('Gherkin conversion error:', error);
      // Generate locally on error
      setGeneratedGherkin(generateLocalGherkin(issue));
      toast.success('Gherkin generated (local)');
    } finally {
      setGherkinLoading(false);
    }
  };

  // Generate Gherkin locally from issue
  const generateLocalGherkin = (issue: Issue): string => {
    const template = GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES];
    
    return `Feature: ${issue.title}
  As a user
  I want to ${issue.title.toLowerCase()}
  So that I can achieve the expected outcome

  Background:
    Given the system is accessible
    And I am authenticated

  @${issue.type} @${issue.priority}
  Scenario: Successfully ${issue.title.toLowerCase()}
    Given ${issue.description || 'the preconditions are met'}
    When I perform the required action
    Then the expected result should occur
    And the system state should be valid

  @negative
  Scenario: Handle error case for ${issue.title.toLowerCase()}
    Given the preconditions are NOT met
    When I attempt the action
    Then an appropriate error should be shown
    And the system should remain stable
`;
  };

  // Convert text to Gherkin
  const handleTextToGherkin = async () => {
    if (!requirementText.trim()) {
      toast.error('Please enter requirement text');
      return;
    }

    setGherkinLoading(true);
    
    try {
      const response = await fetch(`${GHERKIN_API}/api/gherkin/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: {
            title: 'Custom Requirement',
            description: requirementText,
            source: 'manual'
          },
          include_background: true,
          include_scenarios: true,
          max_scenarios: 5
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedGherkin(data.gherkin || generateGherkinFromText(requirementText));
        toast.success('Gherkin generated successfully');
      } else {
        setGeneratedGherkin(generateGherkinFromText(requirementText));
        toast.success('Gherkin generated (local)');
      }
    } catch (error) {
      setGeneratedGherkin(generateGherkinFromText(requirementText));
      toast.success('Gherkin generated (local)');
    } finally {
      setGherkinLoading(false);
    }
  };

  // Generate Gherkin from text
  const generateGherkinFromText = (text: string): string => {
    const lines = text.split('\n').filter(l => l.trim());
    const title = lines[0] || 'Custom Feature';
    const desc = lines.slice(1).join(' ') || text;

    return `Feature: ${title}
  As a stakeholder
  I want to ${title.toLowerCase()}
  So that business value is delivered

  Background:
    Given the system is operational
    And all dependencies are available

  Scenario: Primary success path
    Given ${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}
    When the user performs the action
    Then the expected outcome occurs

  Scenario: Edge case handling
    Given an edge case condition exists
    When the user attempts the action
    Then appropriate handling occurs
`;
  };

  // Copy Gherkin to clipboard
  const copyGherkinToClipboard = () => {
    navigator.clipboard.writeText(generatedGherkin);
    toast.success('Copied to clipboard');
  };

  // Download Gherkin as file
  const downloadGherkin = () => {
    const blob = new Blob([generatedGherkin], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feature_${Date.now()}.feature`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Filter handler
  const handleFilterChange = (type: string, value: string) => {
    if (type === 'clear') {
      setActiveFilters({});
      return;
    }
    
    setActiveFilters(prev => {
      const current = prev[type] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      
      if (updated.length === 0) {
        const { [type]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [type]: updated };
    });
  };
  
  // Filter issues
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = !searchQuery || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.key.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !activeFilters.type?.length || activeFilters.type.includes(issue.type);
    const matchesPriority = !activeFilters.priority?.length || activeFilters.priority.includes(issue.priority);
    const matchesAssignee = !activeFilters.assignee?.length || 
      (activeFilters.assignee.includes('unassigned') && !issue.assigneeId) ||
      (issue.assigneeId && activeFilters.assignee.includes(issue.assigneeId));
    
    return matchesSearch && matchesType && matchesPriority && matchesAssignee;
  });
  
  // Group issues by status
  const issuesByColumn = columns.reduce((acc, col) => {
    acc[col.id] = filteredIssues.filter(i => i.status === col.id);
    return acc;
  }, {} as Record<string, Issue[]>);
  
  // Drag handlers
  const handleDragStart = (e: React.DragEvent, issue: Issue) => {
    setDraggedIssue(issue);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedIssue) {
      const oldStatus = draggedIssue.status;
      
      // Optimistic update
      setIssues(prev => prev.map(issue => 
        issue.id === draggedIssue.id ? { ...issue, status: newStatus } : issue
      ));
      
      const col = columns.find(c => c.id === newStatus);
      toast.success(`Moved to ${col?.name || newStatus}`);

      // Update backend
      try {
        await fetch(`${API_BASE}/issues/${draggedIssue.id}/move?new_status=${newStatus}`, {
          method: 'POST',
        });
      } catch (error) {
        // Revert on error
        setIssues(prev => prev.map(issue => 
          issue.id === draggedIssue.id ? { ...issue, status: oldStatus } : issue
        ));
        toast.error('Failed to update status');
      }
    }
    setDraggedIssue(null);
  };
  
  const handleAssign = (issueId: string, memberId: string) => {
    setIssues(prev => prev.map(issue => 
      issue.id === issueId ? { ...issue, assigneeId: memberId || undefined } : issue
    ));
    const member = teamMembers.find(m => m.id === memberId);
    toast.success(member ? `Assigned to ${member.name}` : 'Unassigned');
  };
  
  const handleIssueUpdate = (updates: Partial<Issue>) => {
    if (selectedIssue) {
      setIssues(prev => prev.map(issue => 
        issue.id === selectedIssue.id ? { ...issue, ...updates } : issue
      ));
      setSelectedIssue(prev => prev ? { ...prev, ...updates } : null);
    }
  };
  
  // Stats
  const activeCycle = cycles.find(c => c.status === 'active');
  const stats = {
    total: filteredIssues.length,
    active: filteredIssues.filter(i => i.status === 'active').length,
    issues: filteredIssues.filter(i => i.type === 'issue').length,
    urgent: filteredIssues.filter(i => i.priority === 'urgent').length,
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Board</h1>
          <p className="text-muted-foreground">Agile work management with QA traceability</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setColumnCustomizerOpen(true)}>
            <Columns className="w-4 h-4 mr-2" />
            Columns
          </Button>
          <Button variant="outline" size="sm" onClick={loadIssues} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => { setCreateDefaultColumn('queue'); setCreateModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Item
          </Button>
        </div>
      </div>
      
      {/* Active Cycle Banner */}
      {activeCycle && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Play className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{activeCycle.name}</h3>
                    <Badge>Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{activeCycle.objective}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{activeCycle.issueIds.length}</p>
                  <p className="text-xs text-muted-foreground">Items</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {activeCycle.startDate} → {activeCycle.endDate}
                  </p>
                  <Progress value={65} className="w-32 h-2 mt-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <LayoutGrid className="w-8 h-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-amber-500">{stats.active}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Open Issues</p>
              <p className="text-2xl font-bold text-red-500">{stats.issues}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Urgent</p>
              <p className="text-2xl font-bold text-orange-500">{stats.urgent}</p>
            </div>
            <Zap className="w-8 h-8 text-orange-500" />
          </CardContent>
        </Card>
      </div>
      
      {/* Search & Quick Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by title or key..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <QuickFilters 
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          teamMembers={teamMembers}
        />
      </div>
      
      {/* Main Content */}
      <div className="flex gap-6">
        {/* Board */}
        <div className="flex-1">
          <Tabs defaultValue="board">
            <TabsList className="mb-4">
              <TabsTrigger value="board" className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="gherkin" className="flex items-center gap-2">
                <BookText className="w-4 h-4" />
                Gherkin
              </TabsTrigger>
              <TabsTrigger value="traceability" className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Traceability
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="board">
              <div className="flex gap-4 overflow-x-auto pb-4">
                {columns.map(column => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    issues={issuesByColumn[column.id] || []}
                    teamMembers={teamMembers}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragStart={handleDragStart}
                    onIssueClick={(issue) => { setSelectedIssue(issue); setDetailOpen(true); }}
                    onAssign={handleAssign}
                    onAddClick={(colId) => {
                      setCreateDefaultColumn(colId);
                      setCreateModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="list">
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Key</th>
                        <th className="text-left p-3 font-medium">Title</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Priority</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Assignee</th>
                        <th className="text-center p-3 font-medium">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map(issue => {
                        const typeConfig = TYPE_CONFIG[issue.type];
                        const priorityConfig = PRIORITY_CONFIG[issue.priority];
                        const column = columns.find(c => c.id === issue.status);
                        const assignee = teamMembers.find(m => m.id === issue.assigneeId);
                        const traceCount = issue.linkedRequirements.length + issue.linkedTestCases.length;
                        
                        return (
                          <tr 
                            key={issue.id} 
                            className="border-b hover:bg-muted/30 cursor-pointer"
                            onClick={() => { setSelectedIssue(issue); setDetailOpen(true); }}
                          >
                            <td className="p-3 font-mono text-sm">{issue.key}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span>{typeConfig.icon}</span>
                                <span className="font-medium">{issue.title}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${priorityConfig.dotColor}`} />
                                <span className="text-sm">{priorityConfig.label}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column?.color }} />
                                <span className="text-sm">{column?.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <TeamAvatar member={assignee} size="sm" />
                                <span className="text-sm">{assignee?.name || 'Unassigned'}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {traceCount > 0 ? (
                                <Badge variant="outline" className="gap-1">
                                  <Link2 className="w-3 h-3" />
                                  {traceCount}
                                </Badge>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gherkin">
              <div className="space-y-4">
                {/* Template Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileCode className="w-5 h-5" />
                      Gherkin Templates
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Click a template to see its structure and use it for conversion</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-5 gap-3">
                      {Object.entries(GHERKIN_TEMPLATES).map(([key, template]) => (
                        <div
                          key={key}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            gherkinTemplate === key 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setGherkinTemplate(key)}
                        >
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Template Preview */}
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-sm">
                            {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.name} Template Preview
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''
                              );
                              toast.success('Template copied to clipboard');
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRequirementText(
                                GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''
                              );
                              toast.info('Template loaded - customize the placeholders {{...}}');
                            }}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Use Template
                          </Button>
                        </div>
                      </div>
                      <pre className="text-xs font-mono bg-background p-3 rounded border overflow-auto max-h-[200px] whitespace-pre-wrap">
                        {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''}
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  {/* Convert from Issue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Convert from Work Item</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Select
                        value={selectedIssueForGherkin}
                        onValueChange={setSelectedIssueForGherkin}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a work item" />
                        </SelectTrigger>
                        <SelectContent>
                          {issues.map(issue => (
                            <SelectItem key={issue.id} value={issue.id}>
                              {issue.key}: {issue.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={() => handleConvertIssueToGherkin(selectedIssueForGherkin)}
                        disabled={!selectedIssueForGherkin || gherkinLoading}
                        className="w-full"
                      >
                        {gherkinLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Gherkin
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Convert from Text */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Convert from Text</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={requirementText}
                        onChange={(e) => setRequirementText(e.target.value)}
                        placeholder="Paste requirement text here..."
                        className="min-h-[80px]"
                      />
                      <Button 
                        onClick={handleTextToGherkin}
                        disabled={!requirementText.trim() || gherkinLoading}
                        className="w-full"
                      >
                        {gherkinLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Convert to Gherkin
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Generated Output */}
                {generatedGherkin && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          Generated Gherkin
                        </CardTitle>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={copyGherkinToClipboard}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                          <Button variant="outline" size="sm" onClick={downloadGherkin}>
                            <Download className="w-4 h-4 mr-2" />
                            Download .feature
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                        {generatedGherkin}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {/* Template Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Selected Template Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono overflow-x-auto text-muted-foreground">
                      {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="traceability">
              <div className="space-y-6">
                {/* Flow Diagram */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GitBranch className="w-5 h-5" />
                      Traceability Flow
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-4 py-8">
                      <div className="flex-1 text-center cursor-pointer hover:scale-105 transition-transform" onClick={() => window.location.href = '/requirements'}>
                        <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center mb-2">
                          <FileText className="w-8 h-8 text-blue-500" />
                        </div>
                        <h4 className="font-medium">Requirements</h4>
                        <p className="text-2xl font-bold text-blue-500">
                          {storedRequirements.length}
                        </p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1 text-center">
                        <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mb-2">
                          <LayoutGrid className="w-8 h-8 text-amber-500" />
                        </div>
                        <h4 className="font-medium">Work Items</h4>
                        <p className="text-2xl font-bold text-amber-500">{issues.length}</p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1 text-center cursor-pointer hover:scale-105 transition-transform" onClick={() => window.location.href = '/cases'}>
                        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-2">
                          <TestTube className="w-8 h-8 text-green-500" />
                        </div>
                        <h4 className="font-medium">Test Cases</h4>
                        <p className="text-2xl font-bold text-green-500">
                          {storedTestCases.length}
                        </p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1 text-center cursor-pointer hover:scale-105 transition-transform" onClick={() => window.location.href = '/defects'}>
                        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-2">
                          <Bug className="w-8 h-8 text-red-500" />
                        </div>
                        <h4 className="font-medium">Defects</h4>
                        <p className="text-2xl font-bold text-red-500">
                          {storedDefects.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="hover:border-blue-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/requirements/create'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Plus className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">New Requirement</h4>
                        <p className="text-xs text-muted-foreground">Create requirement</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:border-green-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/cases/create'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Plus className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">New Test Case</h4>
                        <p className="text-xs text-muted-foreground">Create test case</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:border-red-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/defects/create'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <Plus className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">New Defect</h4>
                        <p className="text-xs text-muted-foreground">Report a bug</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:border-purple-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/traceability'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <GitBranch className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">Full Traceability</h4>
                        <p className="text-xs text-muted-foreground">View matrix</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Coverage Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Coverage Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Requirements with Test Cases</span>
                          <span className="text-sm font-medium">
                            {storedRequirements.length > 0 
                              ? Math.round((storedRequirements.filter(r => 
                                  storedTestCases.some(tc => 
                                    (tc.linkedRequirements || []).includes(r.id)
                                  )
                                ).length / storedRequirements.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={storedRequirements.length > 0 
                            ? (storedRequirements.filter(r => 
                                storedTestCases.some(tc => 
                                  (tc.linkedRequirements || []).includes(r.id)
                                )
                              ).length / storedRequirements.length) * 100
                            : 0} 
                          className="h-2" 
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Test Cases Executed</span>
                          <span className="text-sm font-medium">
                            {storedTestCases.length > 0 
                              ? Math.round((storedTestCases.filter(tc => tc.status === 'passed' || tc.status === 'failed').length / storedTestCases.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={storedTestCases.length > 0 
                            ? (storedTestCases.filter(tc => tc.status === 'passed' || tc.status === 'failed').length / storedTestCases.length) * 100
                            : 0} 
                          className="h-2" 
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Defects Resolved</span>
                          <span className="text-sm font-medium">
                            {storedDefects.length > 0 
                              ? Math.round((storedDefects.filter(d => d.status === 'closed' || d.status === 'resolved').length / storedDefects.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={storedDefects.length > 0 
                            ? (storedDefects.filter(d => d.status === 'closed' || d.status === 'resolved').length / storedDefects.length) * 100
                            : 0} 
                          className="h-2" 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Team Panel */}
        <div className="w-72 flex-shrink-0">
          <TeamPanel members={teamMembers} issues={issues} onAssign={handleAssign} />
        </div>
      </div>
      
      {/* Modals */}
      <IssueDetailModal 
        issue={selectedIssue}
        teamMembers={teamMembers}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdate={handleIssueUpdate}
      />
      
      <ColumnCustomizer
        columns={columns}
        onSave={setColumns}
        open={columnCustomizerOpen}
        onClose={() => setColumnCustomizerOpen(false)}
      />

      <CreateIssueModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateIssue}
        teamMembers={teamMembers}
        columns={columns}
        defaultColumn={createDefaultColumn}
      />
    </div>
  );
}
