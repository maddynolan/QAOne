/**
 * ArtifactLockBanner — Shared lock status banner with Check Out / Check In buttons
 *
 * Shows lock status for any artifact and provides actions to acquire/release locks.
 * Drop into any artifact detail/edit page:
 *
 *   <ArtifactLockBanner artifactType="test_case" artifactId={id} />
 */

import React, { useState } from 'react'
import { Lock, Unlock, AlertTriangle, Clock, Shield, User } from 'lucide-react'
import { useArtifactLock } from '@/hooks/useArtifactLock'
import { useAuth } from '@/contexts/AuthContext'

interface ArtifactLockBannerProps {
  /** The artifact type (test_case, api_collection, etc.) */
  artifactType: string
  /** The artifact UUID */
  artifactId: string | null | undefined
  /** Callback when lock is acquired */
  onLockAcquired?: () => void
  /** Callback when lock is released */
  onLockReleased?: () => void
  /** Whether to show in compact mode */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  test_case: 'Test Case',
  api_collection: 'API Collection',
  perf_scenario: 'Performance Scenario',
  mobile_flow: 'Mobile Flow',
  visual_baseline: 'Visual Baseline',
  a11y_config: 'Accessibility Config',
  test_plan: 'Test Plan',
  defect: 'Defect',
  requirement: 'Requirement',
  test_suite: 'Test Suite',
}

export const ArtifactLockBanner: React.FC<ArtifactLockBannerProps> = ({
  artifactType,
  artifactId,
  onLockAcquired,
  onLockReleased,
  compact = false,
  className = '',
}) => {
  const { hasRole } = useAuth()
  const {
    isLocked,
    lockedByName,
    isMyLock,
    expiresAt,
    lockReason,
    loading,
    acquireLock,
    releaseLock,
    forceRelease,
  } = useArtifactLock(artifactType, artifactId)

  const [checkoutReason, setCheckoutReason] = useState('')
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const artifactLabel = ARTIFACT_TYPE_LABELS[artifactType] || artifactType

  // Can current user force-release? (admin/owner/lead)
  const canForceRelease = hasRole('lead')

  const handleCheckOut = async () => {
    setError(null)
    const result = await acquireLock(checkoutReason)
    if (result.success) {
      setShowReasonInput(false)
      setCheckoutReason('')
      onLockAcquired?.()
    } else {
      setError(result.message)
    }
  }

  const handleCheckIn = async () => {
    setError(null)
    const result = await releaseLock()
    if (result.success) {
      onLockReleased?.()
    } else {
      setError(result.message)
    }
  }

  const handleForceRelease = async () => {
    if (!confirm('Force-release this lock? The current editor will lose their check-out.')) return
    setError(null)
    const result = await forceRelease('Admin force-release')
    if (!result.success) {
      setError(result.message)
    }
  }

  const formatExpiry = (iso: string | null) => {
    if (!iso) return ''
    try {
      const date = new Date(iso)
      const diff = date.getTime() - Date.now()
      if (diff <= 0) return 'Expired'
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      if (hours > 0) return `${hours}h ${minutes}m remaining`
      return `${minutes}m remaining`
    } catch {
      return ''
    }
  }

  if (!artifactId) return null

  // ==================== Compact Mode ====================
  if (compact) {
    if (!isLocked) {
      return (
        <button
          onClick={handleCheckOut}
          disabled={loading}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent transition-colors ${className}`}
        >
          <Unlock className="h-3 w-3" />
          Check Out
        </button>
      )
    }

    if (isMyLock) {
      return (
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors ${className}`}
        >
          <Lock className="h-3 w-3" />
          Check In
        </button>
      )
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20 ${className}`}>
        <Lock className="h-3 w-3" />
        Locked by {lockedByName || 'another user'}
      </span>
    )
  }

  // ==================== Full Banner Mode ====================

  // Not locked — show Check Out button
  if (!isLocked) {
    return (
      <div className={`flex items-center justify-between p-3 rounded-lg border border-border bg-card ${className}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Unlock className="h-4 w-4 text-green-500" />
          <span>{artifactLabel} is available for editing</span>
        </div>
        <div className="flex items-center gap-2">
          {showReasonInput ? (
            <>
              <input
                type="text"
                value={checkoutReason}
                onChange={(e) => setCheckoutReason(e.target.value)}
                placeholder="Reason (optional)"
                className="px-2 py-1 text-sm border border-border rounded-md bg-background w-48"
                onKeyDown={(e) => e.key === 'Enter' && handleCheckOut()}
                autoFocus
              />
              <button
                onClick={handleCheckOut}
                disabled={loading}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Checking out...' : 'Check Out'}
              </button>
              <button
                onClick={() => { setShowReasonInput(false); setCheckoutReason('') }}
                className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowReasonInput(true)}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" />
              Check Out
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
    )
  }

  // Locked by me — show Check In button
  if (isMyLock) {
    return (
      <div className={`p-3 rounded-lg border border-primary/30 bg-primary/5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Checked out by you</div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {expiresAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatExpiry(expiresAt)}
                  </span>
                )}
                {lockReason && (
                  <span>Reason: {lockReason}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-md border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <Unlock className="h-3.5 w-3.5" />
            {loading ? 'Checking in...' : 'Check In'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
    )
  }

  // Locked by another user — show read-only warning
  return (
    <div className={`p-3 rounded-lg border border-destructive/30 bg-destructive/5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <div className="text-sm font-medium text-destructive">
              Checked out by {lockedByName || 'another user'}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Read-only mode
              </span>
              {expiresAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatExpiry(expiresAt)}
                </span>
              )}
              {lockReason && (
                <span>Reason: {lockReason}</span>
              )}
            </div>
          </div>
        </div>
        {canForceRelease && (
          <button
            onClick={handleForceRelease}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            title="Admin: Force-release this lock"
          >
            <Shield className="h-3.5 w-3.5" />
            Force Release
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  )
}

/**
 * LockStatusBadge — Small inline badge showing lock status
 * For use in list views (test case table, collection sidebar, etc.)
 */
export const LockStatusBadge: React.FC<{
  artifactType: string
  artifactId: string
  className?: string
}> = ({ artifactType, artifactId, className = '' }) => {
  const { isLocked, isMyLock, lockedByName } = useArtifactLock(artifactType, artifactId, {
    pollInterval: 60000, // Poll less frequently in list views
  })

  if (!isLocked) return null

  if (isMyLock) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-medium ${className}`}
        title="Checked out by you"
      >
        <Lock className="h-2.5 w-2.5" />
        Mine
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive/10 text-destructive font-medium ${className}`}
      title={`Locked by ${lockedByName || 'another user'}`}
    >
      <Lock className="h-2.5 w-2.5" />
      {lockedByName || 'Locked'}
    </span>
  )
}

export default ArtifactLockBanner
