/**
 * UpgradeCard — Reusable upgrade prompt card
 *
 * Shown when a user on a lower tier tries to access a gated feature.
 * Displays lock icon, feature name, required tier, and upgrade CTA.
 */

import React from 'react'
import { Lock, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLAN_FEATURES } from '@/contexts/PlanContext'

interface UpgradeCardProps {
  feature: string           // Feature ID from PLAN_FEATURES
  currentPlan?: string      // Current plan name
  compact?: boolean         // Compact mode for inline use
  className?: string
}

export function UpgradeCard({ feature, currentPlan = 'free', compact = false, className = '' }: UpgradeCardProps) {
  const featureInfo = PLAN_FEATURES[feature]
  const label = featureInfo?.label || feature
  const description = featureInfo?.description || 'This feature requires a higher plan.'
  const requiredTier = featureInfo?.tier || 'pro'
  const tierLabel = requiredTier === 'enterprise' ? 'Enterprise' : 'Pro'

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl ${className}`}>
        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400 mx-2">requires</span>
          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{tierLabel}</span>
        </div>
        <a
          href="/pricing"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-shrink-0"
        >
          Upgrade <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    )
  }

  return (
    <div className={`max-w-sm w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center shadow-md ${className}`}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 mb-4">
        <Lock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
        {label}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {description}
      </p>

      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium mb-4">
        <Sparkles className="w-3 h-3" />
        {tierLabel} Plan
      </div>

      <Button
        asChild
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
      >
        <a href="/pricing">
          Upgrade to {tierLabel}
        </a>
      </Button>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
        Current: <span className="capitalize font-medium">{currentPlan}</span>
      </p>
    </div>
  )
}

export default UpgradeCard
