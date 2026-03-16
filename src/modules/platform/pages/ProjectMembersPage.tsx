/**
 * ProjectMembersPage — Manage project members and their roles
 *
 * Features:
 * - View all members in the current project
 * - Assign/change project roles (admin, lead, tester, viewer)
 * - Invite new members to the project
 * - Remove members from the project
 * - Role descriptions and permission details
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Users, Shield, UserPlus, Trash2, ChevronDown, Search,
  Crown, Star, Wrench, Eye, Loader2, AlertCircle
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

interface ProjectMember {
  user_id: string
  email: string
  name: string
  avatar_url?: string
  project_role: string
  joined_at?: string
  last_active?: string
}

const PROJECT_ROLES = [
  {
    value: 'admin',
    label: 'Admin',
    icon: Crown,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    description: 'Full access including member and settings management',
  },
  {
    value: 'lead',
    label: 'Lead',
    icon: Star,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    description: 'Full CRUD plus lock management, no settings access',
  },
  {
    value: 'tester',
    label: 'Tester',
    icon: Wrench,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    description: 'Create and edit artifacts, cannot delete or manage members',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    icon: Eye,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    description: 'Read-only access to all artifacts',
  },
]

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'Create, read, update, delete all artifacts',
    'Manage project members and roles',
    'Force-release locks',
    'Manage project settings',
  ],
  lead: [
    'Create, read, update, delete all artifacts',
    'Force-release locks held by others',
    'Cannot manage members or settings',
  ],
  tester: [
    'Create and update test cases, API collections, etc.',
    'Run tests and view results',
    'Cannot delete artifacts',
    'Cannot manage members',
  ],
  viewer: [
    'View all artifacts (read-only)',
    'Cannot create, edit, or delete anything',
    'Cannot run tests',
  ],
}

export const ProjectMembersPage: React.FC = () => {
  const { currentProject, currentOrg, hasPermission, isDemoMode } = useAuth()
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('tester')
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null)

  const canManageMembers = hasPermission('members:manage')

  // ==================== Fetch Members ====================

  const fetchMembers = useCallback(async () => {
    if (!currentProject?.id) return
    setLoading(true)
    try {
      if (isDemoMode) {
        // Demo data
        setMembers([
          {
            user_id: '22222222-2222-2222-2222-222222222222',
            email: 'demo@qaone.com',
            name: 'Demo User',
            project_role: 'admin',
            joined_at: new Date().toISOString(),
          },
          {
            user_id: '33333333-3333-3333-3333-333333333333',
            email: 'lead@qaone.com',
            name: 'QA Lead',
            project_role: 'lead',
            joined_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          },
          {
            user_id: '44444444-4444-4444-4444-444444444444',
            email: 'tester@qaone.com',
            name: 'Test Engineer',
            project_role: 'tester',
            joined_at: new Date(Date.now() - 86400000 * 14).toISOString(),
          },
          {
            user_id: '55555555-5555-5555-5555-555555555555',
            email: 'viewer@qaone.com',
            name: 'Stakeholder',
            project_role: 'viewer',
            joined_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          },
        ])
        return
      }

      const response = await apiClient.get(
        `/api/projects/${currentProject.id}/members`
      )
      setMembers(response.data.members || [])
    } catch (err: any) {
      console.warn('Failed to fetch members:', err)
      // Fallback to empty list
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [currentProject?.id, isDemoMode])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // ==================== Change Role ====================

  const handleRoleChange = async (userId: string, newRole: string) => {
    setError(null)
    setSuccessMsg(null)
    try {
      if (!isDemoMode) {
        await apiClient.put(
          `/api/projects/${currentProject?.id}/members/${userId}/role`,
          { project_role: newRole }
        )
      }
      setMembers(prev =>
        prev.map(m =>
          m.user_id === userId ? { ...m, project_role: newRole } : m
        )
      )
      setRoleDropdownOpen(null)
      setSuccessMsg('Role updated successfully')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to change role')
    }
  }

  // ==================== Invite Member ====================

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setError(null)
    try {
      if (!isDemoMode) {
        await apiClient.post(`/api/projects/${currentProject?.id}/members`, {
          email: inviteEmail.trim(),
          project_role: inviteRole,
        })
      }
      // Add to local state (optimistic)
      setMembers(prev => [
        ...prev,
        {
          user_id: crypto.randomUUID(),
          email: inviteEmail.trim(),
          name: inviteEmail.split('@')[0],
          project_role: inviteRole,
          joined_at: new Date().toISOString(),
        },
      ])
      setInviteEmail('')
      setShowInviteForm(false)
      setSuccessMsg('Member invited successfully')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to invite member')
    }
  }

  // ==================== Remove Member ====================

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return
    setError(null)
    try {
      if (!isDemoMode) {
        await apiClient.delete(
          `/api/projects/${currentProject?.id}/members/${userId}`
        )
      }
      setMembers(prev => prev.filter(m => m.user_id !== userId))
      setSuccessMsg('Member removed')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to remove member')
    }
  }

  // ==================== Filter ====================

  const filteredMembers = members.filter(
    m =>
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleConfig = (role: string) =>
    PROJECT_ROLES.find(r => r.value === role) || PROJECT_ROLES[2]

  // ==================== Render ====================

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Project Members
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage who has access to{' '}
            <span className="font-medium text-foreground">
              {currentProject?.name || 'this project'}
            </span>
          </p>
        </div>
        {canManageMembers && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 text-sm"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
          {successMsg}
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && canManageMembers && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h3 className="font-medium text-sm">Invite a new member</h3>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background"
            >
              {PROJECT_ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleInvite}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Send Invite
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background"
        />
      </div>

      {/* Role Legend */}
      <div className="grid grid-cols-4 gap-3">
        {PROJECT_ROLES.map(role => {
          const Icon = role.icon
          const count = members.filter(m => m.project_role === role.value).length
          return (
            <div
              key={role.value}
              className={`p-3 rounded-lg border border-border ${role.bgColor}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${role.color}`} />
                <span className="text-sm font-medium">{role.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{count}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {role.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No members match your search' : 'No members found'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map(member => {
            const roleConfig = getRoleConfig(member.project_role)
            const RoleIcon = roleConfig.icon

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {(member.name || member.email)[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{member.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </div>
                </div>

                {/* Role Badge / Dropdown */}
                <div className="relative">
                  {canManageMembers ? (
                    <button
                      onClick={() =>
                        setRoleDropdownOpen(
                          roleDropdownOpen === member.user_id ? null : member.user_id
                        )
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${roleConfig.bgColor} ${roleConfig.color} hover:opacity-80 transition-opacity`}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {roleConfig.label}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </button>
                  ) : (
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${roleConfig.bgColor} ${roleConfig.color}`}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {roleConfig.label}
                    </span>
                  )}

                  {/* Role dropdown */}
                  {roleDropdownOpen === member.user_id && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                      {PROJECT_ROLES.map(role => {
                        const Icon = role.icon
                        return (
                          <button
                            key={role.value}
                            onClick={() => handleRoleChange(member.user_id, role.value)}
                            className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent transition-colors ${
                              member.project_role === role.value ? 'bg-accent/50' : ''
                            }`}
                          >
                            <Icon className={`h-4 w-4 mt-0.5 ${role.color}`} />
                            <div>
                              <div className="text-sm font-medium">{role.label}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {role.description}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {canManageMembers && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id, member.name)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove from project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Permissions Reference */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5" />
          Permission Matrix
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {PROJECT_ROLES.map(role => (
            <div
              key={role.value}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-2 mb-2">
                <role.icon className={`h-4 w-4 ${role.color}`} />
                <span className="font-medium text-sm">{role.label}</span>
              </div>
              <ul className="space-y-1">
                {(ROLE_PERMISSIONS[role.value] || []).map((perm, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">•</span>
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProjectMembersPage
