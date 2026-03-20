/**
 * PlanContext — Subscription Plan & Feature Gating
 *
 * Provides tiered feature gating based on the org's subscription plan.
 * Fetches plan limits and usage from GET /api/subscriptions/limits.
 *
 * Tier hierarchy: free (0) < pro (2) <= trial (3) = enterprise (3)
 * Trial unlocks ALL Pro features for 14 days.
 *
 * Usage:
 *   const { plan, isFeatureAvailable, usage, limits } = usePlan()
 *   if (!isFeatureAvailable('flowpilot')) showUpgradeCard()
 *
 *   <PlanGate feature="flowpilot">
 *     <FlowpilotPage />
 *   </PlanGate>
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { apiClient } from '@/lib/api-client'

// ==================== Feature Definitions ====================

export interface PlanFeature {
  id: string
  label: string
  tier: 'free' | 'pro' | 'enterprise'
  description: string
}

export const PLAN_FEATURES: Record<string, PlanFeature> = {
  // Free tier
  recording:           { id: 'recording',           label: 'Recording',           tier: 'free',       description: 'Browser recording & playback' },
  basic_test_builder:  { id: 'basic_test_builder',  label: 'Test Builder',        tier: 'free',       description: 'Visual no-code test builder' },
  playback:            { id: 'playback',            label: 'Playback',            tier: 'free',       description: 'Test playback (3/day on free)' },
  // Pro tier
  ai_healing:          { id: 'ai_healing',          label: 'AI Self-Healing',     tier: 'pro',        description: 'AI-powered selector healing' },
  flowpilot:           { id: 'flowpilot',           label: 'Flowpilot',           tier: 'pro',        description: 'Goal-based agentic testing' },
  api_testing:         { id: 'api_testing',         label: 'API Testing',         tier: 'pro',        description: 'Multi-protocol API testing' },
  performance_testing: { id: 'performance_testing', label: 'Performance Testing', tier: 'pro',        description: 'Load & stress testing' },
  mobile_testing:      { id: 'mobile_testing',      label: 'Mobile Testing',      tier: 'pro',        description: 'Native mobile app testing' },
  visual_testing:      { id: 'visual_testing',      label: 'Visual Testing',      tier: 'pro',        description: 'Visual regression testing' },
  accessibility_testing: { id: 'accessibility_testing', label: 'Accessibility',   tier: 'pro',        description: 'WCAG compliance scanning' },
  salesforce:          { id: 'salesforce',          label: 'Salesforce',          tier: 'pro',        description: 'Salesforce-specific testing' },
  exports:             { id: 'exports',             label: 'CI/CD Exports',       tier: 'pro',        description: 'CI/CD pipeline exports' },
  // Enterprise tier
  sso_saml:            { id: 'sso_saml',            label: 'SSO/SAML',            tier: 'enterprise', description: 'Single sign-on with SAML/OIDC' },
  sso_oidc:            { id: 'sso_oidc',            label: 'SSO/OIDC',            tier: 'enterprise', description: 'Single sign-on with OIDC' },
  audit_trail:         { id: 'audit_trail',         label: 'Audit Trail',         tier: 'enterprise', description: 'Enterprise audit logging' },
  compliance_reporting: { id: 'compliance_reporting', label: 'Compliance Reports', tier: 'enterprise', description: 'SOC 2, HIPAA, GDPR reports' },
  schema_isolation:    { id: 'schema_isolation',    label: 'Schema Isolation',    tier: 'enterprise', description: 'Per-tenant DB isolation' },
  service_accounts:    { id: 'service_accounts',    label: 'Service Accounts',    tier: 'enterprise', description: 'CI/CD API tokens' },
}

// Tier hierarchy
const TIER_HIERARCHY: Record<string, number> = { free: 0, pro: 2, trial: 3, enterprise: 3 }

// ==================== Types ====================

interface PlanUsage {
  projects: number
  users: number
  test_runs_this_month: number
  playbacks_today: number
}

interface PlanLimits {
  max_users: number
  max_test_runs_per_month: number
  max_projects: number
  max_playbacks_per_day: number
}

interface PlanContextType {
  // Current plan info
  plan: string          // 'free' | 'trial' | 'pro' | 'enterprise'
  status: string        // 'active' | 'expired'
  daysRemaining: number // -1 for unlimited

  // Usage & limits
  usage: PlanUsage
  limits: PlanLimits

  // Feature gating
  isFeatureAvailable: (featureId: string) => boolean
  features: Record<string, boolean>  // precomputed feature availability map

  // Loading state
  loading: boolean

  // Refresh limits data
  refresh: () => Promise<void>
}

const defaultUsage: PlanUsage = { projects: 0, users: 0, test_runs_this_month: 0, playbacks_today: 0 }
const defaultLimits: PlanLimits = { max_users: 1, max_test_runs_per_month: 100, max_projects: 1, max_playbacks_per_day: 3 }

const PlanContext = createContext<PlanContextType | undefined>(undefined)

export const usePlan = () => {
  const context = useContext(PlanContext)
  if (context === undefined) {
    throw new Error('usePlan must be used within a PlanProvider')
  }
  return context
}

// ==================== Provider ====================

interface PlanProviderProps {
  children: React.ReactNode
}

// Electron desktop app has its own license gating (LicenseGate) — PlanGate should not double-gate
const isElectronApp = typeof window !== 'undefined' &&
  (!!((window as any).electronAPI) || !!((window as any).flowstral) || navigator.userAgent.toLowerCase().includes('electron'))

export function PlanProvider({ children }: PlanProviderProps) {
  const { subscription, isAuthenticated, isDemoMode } = useAuth()
  // In demo mode or Electron, initialize as enterprise to avoid flash of "free" gating
  const shouldUnlock = isDemoMode || isElectronApp
  const [plan, setPlan] = useState<string>(shouldUnlock ? 'enterprise' : 'free')
  const [status, setStatus] = useState<string>('active')
  const [daysRemaining, setDaysRemaining] = useState<number>(-1)
  const [usage, setUsage] = useState<PlanUsage>(defaultUsage)
  const [limits, setLimits] = useState<PlanLimits>(defaultLimits)
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Compute feature availability from plan
  const computeFeatures = useCallback((currentPlan: string): Record<string, boolean> => {
    const planLevel = TIER_HIERARCHY[currentPlan] ?? 0
    const result: Record<string, boolean> = {}
    for (const [key, feat] of Object.entries(PLAN_FEATURES)) {
      const requiredLevel = TIER_HIERARCHY[feat.tier] ?? 0
      result[key] = planLevel >= requiredLevel
    }
    return result
  }, [])

  // Fetch limits from backend (skipped in demo mode and Electron desktop)
  const fetchLimits = useCallback(async () => {
    // Demo mode or Electron = everything unlocked, no API call needed
    if (shouldUnlock) {
      setPlan('enterprise')
      setFeatures(computeFeatures('enterprise'))
      setLoading(false)
      return
    }
    try {
      const response = await apiClient.get('/api/subscriptions/limits')
      const data = response.data

      const fetchedPlan = data.plan || 'free'
      setPlan(fetchedPlan)
      setStatus(data.status || 'active')
      setDaysRemaining(data.days_remaining ?? -1)
      setUsage(data.usage || defaultUsage)
      setLimits(data.limits || defaultLimits)

      // Use server-provided features if available, otherwise compute locally
      if (data.features && Object.keys(data.features).length > 0) {
        setFeatures(data.features)
      } else {
        setFeatures(computeFeatures(fetchedPlan))
      }
    } catch (error) {
      console.warn('[PlanContext] Failed to fetch limits, using defaults:', error)
      // Use subscription from AuthContext as fallback, default to trial for authenticated users
      const fallbackPlan = subscription?.plan || 'trial'
      setPlan(fallbackPlan)
      setStatus(subscription?.status || 'active')
      setDaysRemaining(subscription?.daysRemaining ?? 14)
      setFeatures(computeFeatures(fallbackPlan))
    } finally {
      setLoading(false)
    }
  }, [subscription, computeFeatures, shouldUnlock])

  // In demo mode or Electron desktop, unlock everything
  useEffect(() => {
    if (shouldUnlock) {
      setPlan('enterprise')
      setStatus('active')
      setDaysRemaining(-1)
      setUsage(defaultUsage)
      setLimits({ max_users: 999999, max_test_runs_per_month: 999999, max_projects: 999999, max_playbacks_per_day: 999999 })
      setFeatures(computeFeatures('enterprise'))
      setLoading(false)
      return
    }

    if (isAuthenticated) {
      fetchLimits()
    } else {
      // Not authenticated — set to free defaults
      setPlan('free')
      setFeatures(computeFeatures('free'))
      setLoading(false)
    }
  }, [isAuthenticated, shouldUnlock, fetchLimits, computeFeatures])

  // Listen for subscription limit exceeded events from api-client interceptor
  useEffect(() => {
    const handleLimitExceeded = (event: CustomEvent) => {
      // Refresh limits to get updated usage numbers
      fetchLimits()
    }

    window.addEventListener('subscription:limit-exceeded', handleLimitExceeded as EventListener)
    return () => window.removeEventListener('subscription:limit-exceeded', handleLimitExceeded as EventListener)
  }, [fetchLimits])

  const isFeatureAvailable = useCallback((featureId: string): boolean => {
    // Demo mode = everything available
    if (shouldUnlock) return true

    // Check precomputed map first
    if (featureId in features) {
      return features[featureId]
    }

    // Compute dynamically for unknown features
    const feat = PLAN_FEATURES[featureId]
    if (!feat) return true // Unknown feature = allow

    const planLevel = TIER_HIERARCHY[plan] ?? 0
    const requiredLevel = TIER_HIERARCHY[feat.tier] ?? 0
    return planLevel >= requiredLevel
  }, [features, plan, shouldUnlock])

  const value = useMemo(() => ({
    plan,
    status,
    daysRemaining,
    usage,
    limits,
    isFeatureAvailable,
    features,
    loading,
    refresh: fetchLimits,
  }), [plan, status, daysRemaining, usage, limits, isFeatureAvailable, features, loading, fetchLimits])

  // Trial expiry warning banner (dismissible, stored in sessionStorage)
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem('flowstral_trial_banner_dismissed') === 'true' } catch { return false }
  })

  const showTrialBanner = plan === 'trial' && daysRemaining >= 0 && daysRemaining <= 7 && !bannerDismissed && !shouldUnlock

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true)
    try { sessionStorage.setItem('flowstral_trial_banner_dismissed', 'true') } catch {}
  }, [])

  return (
    <PlanContext.Provider value={value}>
      {showTrialBanner && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {daysRemaining === 0
                ? 'Your trial expires today!'
                : `Your trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`}
            </span>
            <a href="/pricing" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Upgrade now
            </a>
          </div>
          <button
            onClick={dismissBanner}
            className="text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-300 p-1"
            aria-label="Dismiss trial banner"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {children}
    </PlanContext.Provider>
  )
}

// ==================== PlanGate Component ====================

interface PlanGateProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renders children only if the feature is available on the current plan.
 * Otherwise renders the UpgradeCard (or custom fallback).
 */
export function PlanGate({ feature, children, fallback }: PlanGateProps) {
  const { isFeatureAvailable, plan } = usePlan()

  if (isFeatureAvailable(feature)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  // Default: render UpgradeCard
  const featureInfo = PLAN_FEATURES[feature]
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <UpgradeCardInline
        feature={feature}
        featureLabel={featureInfo?.label || feature}
        featureDescription={featureInfo?.description || `This feature requires a higher plan.`}
        requiredTier={featureInfo?.tier || 'pro'}
        currentPlan={plan}
      />
    </div>
  )
}

// ==================== Inline Upgrade Card ====================

function UpgradeCardInline({
  feature,
  featureLabel,
  featureDescription,
  requiredTier,
  currentPlan,
}: {
  feature: string
  featureLabel: string
  featureDescription: string
  requiredTier: string
  currentPlan: string
}) {
  return (
    <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center shadow-lg">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 mb-6">
        <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>

      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        {featureLabel}
      </h3>
      <p className="text-slate-500 dark:text-slate-400 mb-2">
        {featureDescription}
      </p>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium mb-6">
        Requires {requiredTier === 'enterprise' ? 'Enterprise' : 'Pro'} plan
      </div>

      <div className="space-y-3">
        <a
          href="/pricing"
          className="block w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
        >
          Upgrade to {requiredTier === 'enterprise' ? 'Enterprise' : 'Pro'}
        </a>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          You're on the <span className="font-medium capitalize">{currentPlan}</span> plan
        </p>
      </div>
    </div>
  )
}

export default PlanContext
