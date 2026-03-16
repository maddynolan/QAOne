-- ============================================================
-- Migration 041: Service Accounts (API Tokens)
-- CI/CD and programmatic access via long-lived API tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS service_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    token_hash TEXT NOT NULL,
    token_prefix VARCHAR(10) NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    project_ids UUID[] DEFAULT '{}',
    scopes TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMPTZ,
    last_used_ip VARCHAR(45),
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_accounts_org ON service_accounts(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_service_accounts_prefix ON service_accounts(token_prefix);
CREATE INDEX IF NOT EXISTS idx_service_accounts_expires ON service_accounts(expires_at) WHERE expires_at IS NOT NULL;

-- Service account activity log
CREATE TABLE IF NOT EXISTS service_account_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_account_id UUID NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    status_code INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_activity_account ON service_account_activity(service_account_id, created_at DESC);

-- RLS
ALTER TABLE service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_account_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_accounts_read ON service_accounts FOR SELECT USING (true);
CREATE POLICY service_accounts_write ON service_accounts FOR ALL USING (true);
CREATE POLICY sa_activity_read ON service_account_activity FOR SELECT USING (true);
CREATE POLICY sa_activity_write ON service_account_activity FOR INSERT WITH CHECK (true);

COMMENT ON TABLE service_accounts IS 'CI/CD and programmatic access tokens. Token is shown once on creation, only hash stored. Prefix (first 8 chars) stored for identification.';
