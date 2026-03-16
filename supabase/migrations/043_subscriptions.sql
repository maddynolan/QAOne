-- Migration 043: Subscriptions & Email Verification
-- Tracks organization subscriptions, trial periods, and email verification tokens.
--
-- Plan tiers:
--   trial:      14 days, 10 users, 5000 runs/month, 5 projects
--   free:       unlimited time, 3 users, 1000 runs/month, 1 project
--   pro:        paid, 25 users, 50000 runs/month, 20 projects
--   enterprise: unlimited everything

-- ═══════════════════════════════════════════════════════════════════════
-- Subscriptions Table
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,

    -- Plan info
    plan VARCHAR(50) NOT NULL DEFAULT 'trial',       -- trial, free, pro, enterprise
    status VARCHAR(50) NOT NULL DEFAULT 'active',     -- active, expired, cancelled, suspended

    -- Trial tracking
    trial_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trial_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),

    -- Paid plan tracking (future: Stripe integration)
    paid_start TIMESTAMPTZ,
    paid_end TIMESTAMPTZ,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),

    -- Limits
    max_users INTEGER NOT NULL DEFAULT 10,
    max_test_runs_per_month INTEGER NOT NULL DEFAULT 5000,
    max_projects INTEGER NOT NULL DEFAULT 5,

    -- Warning tracking (avoid duplicate emails)
    warning_7d_sent BOOLEAN DEFAULT false,
    warning_3d_sent BOOLEAN DEFAULT false,
    warning_1d_sent BOOLEAN DEFAULT false,
    expired_email_sent BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_org_subscription UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_end);

-- ═══════════════════════════════════════════════════════════════════════
-- Email Verification Tokens
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verification_tokens(user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- Add email_verified column to users (safe IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
