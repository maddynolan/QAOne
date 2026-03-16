/**
 * TrialBanner — Dismissable, user-friendly trial countdown.
 *
 * Shows a subtle top banner when the user is on a trial plan.
 * - Green (>7 days): "X days left in your trial"
 * - Amber (3-7 days): "Your trial expires in X days"
 * - Red (≤3 days): "Your trial expires soon"
 * - Dismissable with × button (stored in localStorage so it stays dismissed)
 * - Re-shows once a day or when the tier changes
 * - Hidden for paid plans (daysRemaining === -1)
 */

import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'flowstral_trial_banner_dismissed';

function getDismissedDate(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function setDismissedDate(): void {
  try {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
  } catch {
    // localStorage unavailable
  }
}

export default function TrialBanner() {
  const { subscription } = useAuth();
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    // Only show for trial plans with positive days remaining
    if (!subscription || subscription.plan !== 'trial' || subscription.daysRemaining < 0) {
      setDismissed(true);
      return;
    }

    const lastDismissed = getDismissedDate();
    const today = new Date().toISOString().slice(0, 10);

    // Re-show if dismissed on a different day or never dismissed
    if (!lastDismissed || lastDismissed !== today) {
      setDismissed(false);
    }
  }, [subscription]);

  const handleDismiss = () => {
    setDismissed(true);
    setDismissedDate();
  };

  if (dismissed || !subscription || subscription.plan !== 'trial') {
    return null;
  }

  const days = subscription.daysRemaining;

  // Color tiers
  const isUrgent = days <= 3;
  const isWarning = days > 3 && days <= 7;
  // const isRelaxed = days > 7;

  const bgClass = isUrgent
    ? 'bg-red-50 border-red-200 text-red-800'
    : isWarning
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800';

  const accentClass = isUrgent
    ? 'text-red-600 hover:text-red-700'
    : isWarning
    ? 'text-amber-600 hover:text-amber-700'
    : 'text-emerald-600 hover:text-emerald-700';

  const dayText = days === 0
    ? 'Your trial expires today'
    : days === 1
    ? 'Your trial expires tomorrow'
    : `${days} days left in your trial`;

  return (
    <div className={cn('flex items-center justify-between px-4 py-2 text-sm border-b', bgClass)}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{dayText}</span>
        <span className="hidden sm:inline text-current/70">—</span>
        <Link
          to="/pricing"
          className={cn('hidden sm:inline font-semibold underline underline-offset-2', accentClass)}
        >
          Upgrade for full access
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className={cn(
          'p-1 rounded-md transition-colors',
          isUrgent
            ? 'hover:bg-red-100'
            : isWarning
            ? 'hover:bg-amber-100'
            : 'hover:bg-emerald-100'
        )}
        aria-label="Dismiss trial banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
