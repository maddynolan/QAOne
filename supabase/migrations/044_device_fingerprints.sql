-- 044_device_fingerprints.sql
-- Adds device fingerprint tracking to prevent trial abuse.
-- Each device gets one trial — reinstalling or clearing data doesn't reset it.

-- Add device_fingerprint column to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_subscriptions_device ON subscriptions(device_fingerprint);

-- Track all trial attempts per device
CREATE TABLE IF NOT EXISTS device_trial_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_fingerprint VARCHAR(128) NOT NULL,
    org_id UUID NOT NULL,
    trial_granted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_trial_fingerprint ON device_trial_history(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_trial_org ON device_trial_history(org_id);

-- Add max_playbacks_per_day column to subscriptions for daily limit enforcement
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_playbacks_per_day INTEGER DEFAULT 999999;
