import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, ShieldAlert } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'owner' | 'admin' | 'member' | 'viewer'
}

/**
 * Role hierarchy: owner > admin > member > viewer
 * Higher roles inherit all permissions of lower roles.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
}

function getUserRoleInOrg(user: any, org: any): string {
  // Check org membership role if available
  if (org?.user_role) return org.user_role
  // Check user metadata for role
  if (user?.user_metadata?.role) return user.user_metadata.role
  if (user?.app_metadata?.role) return user.app_metadata.role
  // Default role for authenticated users
  return 'member'
}

function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
  return userLevel >= requiredLevel
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole
}) => {
  const { currentUser, loading, organizations, currentOrg } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  if (organizations.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  if (!currentOrg) {
    return <Navigate to="/onboarding" replace />
  }

  // Role-based access control enforcement
  if (requiredRole) {
    const userRole = getUserRoleInOrg(currentUser, currentOrg)
    if (!hasRequiredRole(userRole, requiredRole)) {
      return <UnauthorizedPage requiredRole={requiredRole} userRole={userRole} />
    }
  }

  return <>{children}</>
}

/** Inline unauthorized page — shown when user lacks required role */
const UnauthorizedPage: React.FC<{ requiredRole: string; userRole: string }> = ({ requiredRole, userRole }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4 max-w-md text-center p-8">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldAlert className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground">
        This page requires <span className="font-semibold text-foreground">{requiredRole}</span> role or higher.
        Your current role is <span className="font-semibold text-foreground">{userRole}</span>.
      </p>
      <p className="text-sm text-muted-foreground">
        Contact your organization administrator to request access.
      </p>
      <a href="/" className="mt-2 text-primary hover:underline">
        Return to Dashboard
      </a>
    </div>
  </div>
)

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (currentUser) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}


