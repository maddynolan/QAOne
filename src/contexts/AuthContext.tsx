/**
 * AuthContext — Real JWT Authentication with Demo Mode Fallback
 *
 * Modes:
 * 1. Real auth (default): JWT login via POST /api/auth/login, session restore via GET /api/auth/session
 * 2. Demo mode (VITE_DEMO_MODE=true): Hardcoded demo user with auto-login (development/demo)
 *
 * The context provides:
 * - user, currentUser, organizations, projects, currentOrg, currentProject
 * - roles, permissions for RBAC enforcement
 * - signIn, signUp, signOut, switchOrg, switchProject
 * - SSO support (ssoLogin for SAML/OIDC redirect flows)
 * - Token stored in localStorage, auto-refresh on 401 via api-client.ts
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import {
  apiClient,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  getStoredSession,
  setStoredSession,
  setCurrentProjectId,
  setCurrentOrgId,
} from '@/lib/api-client'
import { API_BASE_URL } from '@/lib/api-config'

// ==================== Types ====================

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar_url?: string | null
  auth_provider?: string
  created_at?: string
  updated_at?: string
}

export interface Organization {
  id: string
  name: string
  slug?: string
  description?: string
  user_role?: string
  created_at?: string
  updated_at?: string
}

export interface Project {
  id: string
  org_id: string
  name: string
  slug?: string
  description?: string
  created_at?: string
  updated_at?: string
}

interface AuthContextType {
  // User state
  user: AuthUser | null
  currentUser: any | null // Backward compat with Supabase User type
  organizations: Organization[]
  projects: Project[]
  currentOrg: Organization | null
  currentProject: Project | null
  loading: boolean
  isAuthenticated: boolean
  isDemoMode: boolean

  // RBAC
  roles: string[]
  permissions: string[]
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean

  // Auth actions
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string, orgName?: string) => Promise<void>
  signOut: () => Promise<void>
  ssoLogin: (provider: 'saml' | 'oidc', orgSlug: string) => void

  // Context switching
  setCurrentOrg: (org: Organization) => void
  setCurrentProject: (project: Project) => void
  switchProject: (projectId: string) => void

  // Data refresh
  refreshData: () => Promise<void>

  // JWT token (for WebSocket connections that need it)
  token: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// ==================== Demo Mode Data ====================

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' ||
  import.meta.env.VITE_DEMO_MODE === '1' ||
  // Auto-enable demo mode in development if no explicit setting
  (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false')

const DEMO_USER: AuthUser = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'demo@qaone.com',
  name: 'Demo User',
  avatar_url: null,
  auth_provider: 'demo',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const DEMO_ORG: Organization = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Demo Organization',
  slug: 'demo-org',
  description: 'Demo organization for testing',
  user_role: 'owner',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const DEMO_PROJECT: Project = {
  id: '00000000-0000-0000-0000-000000000000',
  org_id: '11111111-1111-1111-1111-111111111111',
  name: 'Demo Project',
  slug: 'demo-project',
  description: 'Demo project for testing',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const DEMO_ROLES = ['owner']
const DEMO_PERMISSIONS = [
  'test_cases:create', 'test_cases:read', 'test_cases:update', 'test_cases:delete',
  'test_runs:create', 'test_runs:read', 'test_runs:update', 'test_runs:delete',
  'api_collections:create', 'api_collections:read', 'api_collections:update', 'api_collections:delete',
  'perf_scenarios:create', 'perf_scenarios:read', 'perf_scenarios:update', 'perf_scenarios:delete',
  'defects:create', 'defects:read', 'defects:update', 'defects:delete',
  'requirements:create', 'requirements:read', 'requirements:update', 'requirements:delete',
  'members:manage', 'settings:manage', 'locks:admin',
]

// ==================== Provider ====================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null)
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(getStoredToken())
  const initRef = useRef(false)

  // Backward compat: currentUser mimics Supabase User shape
  const currentUser = user
    ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { role: roles[0] || 'member' },
        user_metadata: { name: user.name, avatar_url: user.avatar_url },
        identities: [],
        factors: [],
      }
    : null

  const isDemoMode = IS_DEMO_MODE

  // ==================== Context Sync ====================

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgState(org)
    setCurrentOrgId(org?.id || null)
  }, [])

  const setCurrentProject = useCallback((project: Project) => {
    setCurrentProjectState(project)
    setCurrentProjectId(project?.id || null)
  }, [])

  const switchProject = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setCurrentProject(project)
    }
  }, [projects, setCurrentProject])

  // ==================== Apply Session Data ====================

  const applySession = useCallback((session: any) => {
    const u = session.user
    if (u) {
      setUser({
        id: u.id,
        email: u.email,
        name: u.name || u.email,
        avatar_url: u.avatar_url,
        auth_provider: u.auth_provider || 'local',
        created_at: u.created_at,
        updated_at: u.updated_at,
      })
    }

    const org = session.org
    if (org) {
      const orgObj: Organization = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        user_role: session.roles?.[0] || 'member',
        created_at: org.created_at,
        updated_at: org.updated_at,
      }
      setOrganizations([orgObj])
      setCurrentOrg(orgObj)
    }

    const proj = session.project
    if (proj) {
      const projObj: Project = {
        id: proj.id,
        org_id: proj.org_id || org?.id,
        name: proj.name,
        slug: proj.slug,
        description: proj.description,
        created_at: proj.created_at,
        updated_at: proj.updated_at,
      }
      setProjects([projObj])
      setCurrentProject(projObj)
    }

    setRoles(session.roles || [])
    setPermissions(session.permissions || [])

    // Store session for offline/quick restore
    setStoredSession(session)
  }, [setCurrentOrg, setCurrentProject])

  // ==================== Demo Mode Login ====================

  const demoLogin = useCallback(() => {
    setUser(DEMO_USER)
    setOrganizations([DEMO_ORG])
    setProjects([DEMO_PROJECT])
    setCurrentOrg(DEMO_ORG)
    setCurrentProject(DEMO_PROJECT)
    setRoles(DEMO_ROLES)
    setPermissions(DEMO_PERMISSIONS)
    setToken(null)
    console.log('[Auth] Demo mode — auto-logged in')
  }, [setCurrentOrg, setCurrentProject])

  // ==================== Initialize ====================

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const initialize = async () => {
      try {
        if (IS_DEMO_MODE) {
          demoLogin()
          return
        }

        // Try to restore session from stored JWT
        const storedToken = getStoredToken()
        if (!storedToken) {
          console.log('[Auth] No stored token — user needs to log in')
          return
        }

        // Validate token and restore full session
        try {
          const response = await apiClient.get('/api/auth/session')
          if (response.data && response.data.user) {
            setToken(storedToken)
            applySession(response.data)
            console.log('[Auth] Session restored from stored JWT')
          } else {
            // Invalid session — clear token
            clearStoredToken()
            setToken(null)
            console.log('[Auth] Stored token invalid — cleared')
          }
        } catch (err: any) {
          if (err?.response?.status === 401) {
            clearStoredToken()
            setToken(null)
            console.log('[Auth] Token expired — cleared')
          } else {
            // Network error — try offline session restore
            const cachedSession = getStoredSession()
            if (cachedSession) {
              setToken(storedToken)
              applySession(cachedSession)
              console.log('[Auth] Offline session restored from cache')
            } else {
              console.warn('[Auth] Cannot restore session (network error, no cache)')
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Initialization error:', error)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [demoLogin, applySession])

  // ==================== Listen for auth:expired from api-client ====================

  useEffect(() => {
    const handleAuthExpired = () => {
      console.log('[Auth] Token expired — signing out')
      setUser(null)
      setOrganizations([])
      setProjects([])
      setCurrentOrgState(null)
      setCurrentProjectState(null)
      setRoles([])
      setPermissions([])
      setToken(null)
      setCurrentProjectId(null)
      setCurrentOrgId(null)
    }

    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [])

  // ==================== Sign In ====================

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      if (IS_DEMO_MODE) {
        // In demo mode, accept any credentials
        demoLogin()
        return
      }

      const response = await apiClient.post('/api/auth/login', {
        email,
        password,
        project_id: currentProject?.id || null,
      })

      const data = response.data
      if (!data.token) {
        throw new Error('No token in response')
      }

      // Store token
      setStoredToken(data.token)
      setToken(data.token)

      // Apply session data
      applySession(data)

      console.log('[Auth] Signed in successfully')
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Invalid email or password'
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [currentProject, demoLogin, applySession])

  // ==================== Sign Up ====================

  const signUp = useCallback(async (email: string, password: string, name?: string, orgName?: string) => {
    setLoading(true)
    try {
      if (IS_DEMO_MODE) {
        demoLogin()
        return
      }

      const response = await apiClient.post('/api/auth/signup', {
        email,
        password,
        name: name || email.split('@')[0],
        org_name: orgName || undefined,
      })

      const data = response.data
      if (!data.token) {
        throw new Error('No token in response')
      }

      // Store token
      setStoredToken(data.token)
      setToken(data.token)

      // Apply session data
      applySession(data)

      console.log('[Auth] Signed up successfully')
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to create account'
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [demoLogin, applySession])

  // ==================== Sign Out ====================

  const signOut = useCallback(async () => {
    setLoading(true)
    try {
      if (!IS_DEMO_MODE && token) {
        // Best-effort server logout (revoke token)
        try {
          await apiClient.post('/api/auth/logout')
        } catch {
          // Ignore — logout should always succeed from user perspective
        }
      }

      // Clear all state
      clearStoredToken()
      setUser(null)
      setOrganizations([])
      setProjects([])
      setCurrentOrgState(null)
      setCurrentProjectState(null)
      setRoles([])
      setPermissions([])
      setToken(null)
      setCurrentProjectId(null)
      setCurrentOrgId(null)

      console.log('[Auth] Signed out')
    } catch (error) {
      console.error('[Auth] Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  // ==================== SSO Login ====================

  const ssoLogin = useCallback((provider: 'saml' | 'oidc', orgSlug: string) => {
    // Redirect to SSO endpoint — the backend will redirect to IdP
    const url = `${API_BASE_URL}/api/auth/sso/${provider}/${orgSlug}/login`
    window.location.href = url
  }, [])

  // ==================== Refresh Data ====================

  const refreshData = useCallback(async () => {
    if (IS_DEMO_MODE || !token) return

    try {
      const response = await apiClient.get('/api/auth/session')
      if (response.data && response.data.user) {
        applySession(response.data)
      }
    } catch (error) {
      console.error('[Auth] Refresh data error:', error)
    }
  }, [token, applySession])

  // ==================== RBAC Helpers ====================

  const ROLE_HIERARCHY: Record<string, number> = {
    viewer: 1,
    member: 2,
    tester: 2,
    lead: 3,
    admin: 4,
    owner: 5,
  }

  const hasRole = useCallback((requiredRole: string): boolean => {
    if (IS_DEMO_MODE) return true
    const userMaxLevel = Math.max(
      ...roles.map(r => ROLE_HIERARCHY[r] || 0),
      0
    )
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
    return userMaxLevel >= requiredLevel
  }, [roles])

  const hasPermission = useCallback((permission: string): boolean => {
    if (IS_DEMO_MODE) return true
    // Wildcard check
    if (permissions.includes('*')) return true
    // Exact match
    if (permissions.includes(permission)) return true
    // Module wildcard (e.g., "test_cases:*")
    const [module] = permission.split(':')
    if (permissions.includes(`${module}:*`)) return true
    return false
  }, [permissions])

  // ==================== Context Value ====================

  const value: AuthContextType = {
    user,
    currentUser,
    organizations,
    projects,
    currentOrg,
    currentProject,
    loading,
    isAuthenticated: !!user,
    isDemoMode: IS_DEMO_MODE,
    roles,
    permissions,
    hasRole,
    hasPermission,
    signIn,
    signUp,
    signOut,
    ssoLogin,
    setCurrentOrg,
    setCurrentProject,
    switchProject,
    refreshData,
    token,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Re-export types for consumers
export type { AuthContextType }
