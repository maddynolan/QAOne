/**
 * useArtifactLock — React hook for check-out / check-in locking
 *
 * Provides lock state + actions for any artifact type:
 *   test_case, api_collection, perf_scenario, mobile_flow,
 *   visual_baseline, a11y_config, test_plan, defect, requirement, test_suite
 *
 * Usage:
 *   const { isLocked, lockedBy, isMyLock, acquireLock, releaseLock, loading } =
 *     useArtifactLock('test_case', testCaseId)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export interface LockStatus {
  locked: boolean
  lock_id?: string
  locked_by?: string
  locked_by_name?: string
  locked_at?: string
  lock_expires_at?: string
  lock_reason?: string
}

export interface AcquireLockResult {
  success: boolean
  message: string
  lock?: any
}

export interface UseArtifactLockReturn {
  /** Whether the artifact is currently locked */
  isLocked: boolean
  /** User ID of lock holder */
  lockedBy: string | null
  /** Display name of lock holder */
  lockedByName: string | null
  /** Whether the current user holds the lock */
  isMyLock: boolean
  /** Lock expiration time */
  expiresAt: string | null
  /** Lock reason */
  lockReason: string | null
  /** Whether a lock operation is in progress */
  loading: boolean
  /** Acquire the lock (check out) */
  acquireLock: (reason?: string, durationHours?: number) => Promise<AcquireLockResult>
  /** Release the lock (check in) */
  releaseLock: () => Promise<{ success: boolean; message: string }>
  /** Force-release (admin only) */
  forceRelease: (reason?: string) => Promise<{ success: boolean; message: string }>
  /** Refresh lock status from server */
  refreshLock: () => Promise<void>
  /** Full lock status object */
  lockStatus: LockStatus | null
}

export function useArtifactLock(
  artifactType: string,
  artifactId: string | null | undefined,
  options?: {
    /** Auto-poll interval in ms (0 = disabled, default: 30000) */
    pollInterval?: number
    /** Auto-fetch on mount (default: true) */
    autoFetch?: boolean
  }
): UseArtifactLockReturn {
  const { user } = useAuth()
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const userId = user?.id || null
  const pollInterval = options?.pollInterval ?? 30000
  const autoFetch = options?.autoFetch ?? true

  // Derived state
  const isLocked = lockStatus?.locked ?? false
  const lockedBy = lockStatus?.locked_by ?? null
  const lockedByName = lockStatus?.locked_by_name ?? null
  const isMyLock = isLocked && lockedBy === userId
  const expiresAt = lockStatus?.lock_expires_at ?? null
  const lockReason = lockStatus?.lock_reason ?? null

  // ==================== Fetch Lock Status ====================

  const refreshLock = useCallback(async () => {
    if (!artifactId || !artifactType) return
    try {
      const response = await apiClient.get(
        `/api/locks/status/${artifactType}/${artifactId}`
      )
      setLockStatus(response.data)
    } catch (error) {
      // On error, assume unlocked
      setLockStatus({ locked: false })
    }
  }, [artifactType, artifactId])

  // Auto-fetch on mount and when ID changes
  useEffect(() => {
    if (autoFetch && artifactId) {
      refreshLock()
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [artifactId, autoFetch, refreshLock])

  // Polling
  useEffect(() => {
    if (pollInterval > 0 && artifactId) {
      pollRef.current = setInterval(refreshLock, pollInterval)
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    }
  }, [pollInterval, artifactId, refreshLock])

  // ==================== Acquire Lock ====================

  const acquireLock = useCallback(
    async (reason = '', durationHours = 4): Promise<AcquireLockResult> => {
      if (!artifactId || !artifactType) {
        return { success: false, message: 'No artifact specified' }
      }
      setLoading(true)
      try {
        const response = await apiClient.post('/api/locks/acquire', {
          artifact_type: artifactType,
          artifact_id: artifactId,
          duration_hours: durationHours,
          reason,
        })
        const result = response.data as AcquireLockResult
        // Refresh status after acquire
        await refreshLock()
        return result
      } catch (error: any) {
        const message = error?.response?.data?.detail || error?.message || 'Failed to acquire lock'
        return { success: false, message }
      } finally {
        setLoading(false)
      }
    },
    [artifactType, artifactId, refreshLock]
  )

  // ==================== Release Lock ====================

  const releaseLock = useCallback(async () => {
    if (!artifactId || !artifactType) {
      return { success: false, message: 'No artifact specified' }
    }
    setLoading(true)
    try {
      const response = await apiClient.post('/api/locks/release', {
        artifact_type: artifactType,
        artifact_id: artifactId,
      })
      await refreshLock()
      return response.data
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to release lock'
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }, [artifactType, artifactId, refreshLock])

  // ==================== Force Release ====================

  const forceRelease = useCallback(
    async (reason = '') => {
      if (!artifactId || !artifactType) {
        return { success: false, message: 'No artifact specified' }
      }
      setLoading(true)
      try {
        const response = await apiClient.post('/api/locks/force-release', {
          artifact_type: artifactType,
          artifact_id: artifactId,
          reason,
        })
        await refreshLock()
        return response.data
      } catch (error: any) {
        const message = error?.response?.data?.detail || error?.message || 'Failed to force-release lock'
        return { success: false, message }
      } finally {
        setLoading(false)
      }
    },
    [artifactType, artifactId, refreshLock]
  )

  return {
    isLocked,
    lockedBy,
    lockedByName,
    isMyLock,
    expiresAt,
    lockReason,
    loading,
    acquireLock,
    releaseLock,
    forceRelease,
    refreshLock,
    lockStatus,
  }
}

/**
 * useMyLocks — hook to list all locks held by the current user
 */
export function useMyLocks() {
  const [locks, setLocks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchLocks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiClient.get('/api/locks/mine')
      setLocks(response.data.locks || [])
    } catch {
      setLocks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocks()
  }, [fetchLocks])

  const releaseAll = useCallback(async () => {
    for (const lock of locks) {
      try {
        await apiClient.post('/api/locks/release', {
          artifact_type: lock.artifact_type,
          artifact_id: lock.artifact_id,
        })
      } catch {
        // continue releasing others
      }
    }
    await fetchLocks()
  }, [locks, fetchLocks])

  return { locks, loading, refresh: fetchLocks, releaseAll }
}
