import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, AuthService, OrganizationService, ProjectService } from '@/lib/supabase-service'
import type { Organization, Project, User as DBUser } from '@/lib/supabase-service'

interface AuthContextType {
  user: DBUser | null
  currentUser: User | null
  organizations: Organization[]
  projects: Project[]
  currentOrg: Organization | null
  currentProject: Project | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
  setCurrentOrg: (org: Organization) => void
  setCurrentProject: (project: Project) => void
  refreshData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hardcoded demo user for testing
const DEMO_USER = {
  id: 'demo-user-123',
  email: 'demo@qaone.com',
  name: 'Demo User',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

const DEMO_ORG = {
  id: 'demo-org-123',
  name: 'Demo Organization',
  slug: 'demo-org',
  description: 'Demo organization for testing',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

const DEMO_PROJECT = {
  id: 'demo-project-123',
  org_id: 'demo-org-123',
  name: 'Demo Project',
  slug: 'demo-project',
  description: 'Demo project for testing',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DBUser | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Auto-login with demo credentials
  useEffect(() => {
    const autoLogin = async () => {
      try {
        // Set demo user data
        setUser(DEMO_USER)
        setCurrentUser({
          id: DEMO_USER.id,
          email: DEMO_USER.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: { name: DEMO_USER.name },
          identities: [],
          factors: []
        })
        
        // Set demo organization and project
        setOrganizations([DEMO_ORG])
        setProjects([DEMO_PROJECT])
        setCurrentOrg(DEMO_ORG)
        setCurrentProject(DEMO_PROJECT)
        
        console.log('Auto-logged in with demo credentials')
      } catch (error) {
        console.error('Auto-login failed:', error)
      } finally {
        setLoading(false)
      }
    }

    autoLogin()
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      // Accept demo credentials or any email/password for testing
      if (email === 'demo@qaone.com' || email.includes('@')) {
        setUser(DEMO_USER)
        setCurrentUser({
          id: DEMO_USER.id,
          email: DEMO_USER.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: { name: DEMO_USER.name },
          identities: [],
          factors: []
        })
        
        setOrganizations([DEMO_ORG])
        setProjects([DEMO_PROJECT])
        setCurrentOrg(DEMO_ORG)
        setCurrentProject(DEMO_PROJECT)
        
        console.log('Logged in successfully')
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true)
    try {
      // For demo purposes, just log them in
      await signIn(email, password)
    } catch (error: any) {
      console.error('Sign up error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      setUser(null)
      setCurrentUser(null)
      setOrganizations([])
      setProjects([])
      setCurrentOrg(null)
      setCurrentProject(null)
      console.log('Logged out successfully')
    } catch (error: any) {
      console.error('Sign out error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    // For demo purposes, data is already set
    console.log('Data refreshed')
  }

  const value: AuthContextType = {
    user,
    currentUser,
    organizations,
    projects,
    currentOrg,
    currentProject,
    loading,
    signIn,
    signUp,
    signOut,
    setCurrentOrg,
    setCurrentProject,
    refreshData
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}