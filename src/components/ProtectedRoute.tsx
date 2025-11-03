import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'owner' | 'admin' | 'member' | 'viewer'
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

  // TODO: Implement role-based access control
  // For now, allow all authenticated users
  if (requiredRole) {
    // This would check the user's role in the current organization
    // const userRole = getUserRoleInOrg(currentUser.id, currentOrg.id)
    // if (!hasRequiredRole(userRole, requiredRole)) {
    //   return <Navigate to="/unauthorized" replace />
    // }
  }

  return <>{children}</>
}

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


