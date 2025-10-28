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

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<DBUser | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshData = async () => {
    if (!currentUser) return

    try {
      // Get user profile
      const userProfile = await AuthService.getCurrentUser()
      setUser(userProfile)

      // Get organizations
      const orgs = await OrganizationService.getOrganizations()
      setOrganizations(orgs)

      // Set current org if not set
      if (!currentOrg && orgs.length > 0) {
        setCurrentOrg(orgs[0])
      }

      // Get projects for current org
      if (currentOrg) {
        const projs = await ProjectService.getProjects(currentOrg.id)
        setProjects(projs)

        // Set current project if not set
        if (!currentProject && projs.length > 0) {
          setCurrentProject(projs[0])
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
    }
  }

  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setCurrentUser(session?.user || null)
        
        if (session?.user) {
          await refreshData()
        } else {
          setUser(null)
          setOrganizations([])
          setProjects([])
          setCurrentOrg(null)
          setCurrentProject(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (currentOrg) {
      ProjectService.getProjects(currentOrg.id).then(setProjects)
    }
  }, [currentOrg])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      await AuthService.signIn(email, password)
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true)
    try {
      await AuthService.signUp(email, password, name)
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await AuthService.signOut()
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const handleSetCurrentOrg = (org: Organization) => {
    setCurrentOrg(org)
    setCurrentProject(null) // Reset project when org changes
  }

  const handleSetCurrentProject = (project: Project) => {
    setCurrentProject(project)
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
    setCurrentOrg: handleSetCurrentOrg,
    setCurrentProject: handleSetCurrentProject,
    refreshData
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
