-- Migration 037: SSO Configuration Tables
-- Stores SAML 2.0 and OIDC SSO configuration per organization
-- Supports AD group-to-role mapping via JSONB

-- SSO Configurations table
CREATE TABLE IF NOT EXISTS sso_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    protocol VARCHAR(10) NOT NULL CHECK (protocol IN ('saml', 'oidc')),
    is_enabled BOOLEAN DEFAULT false,

    -- SAML 2.0 fields
    idp_entity_id TEXT,
    idp_sso_url TEXT,
    idp_slo_url TEXT,
    idp_certificate TEXT,  -- Fernet-encrypted in application layer
    sp_entity_id TEXT,

    -- OIDC fields
    oidc_issuer TEXT,
    oidc_client_id TEXT,
    oidc_client_secret_encrypted TEXT,  -- Fernet-encrypted
    oidc_scopes TEXT DEFAULT 'openid profile email',
    oidc_discovery_url TEXT,

    -- JIT Provisioning settings
    auto_provision_users BOOLEAN DEFAULT true,
    default_role VARCHAR(50) DEFAULT 'member',

    -- AD Group Mapping
    -- Format: { "AD-Group-Name": { "role": "admin", "project_ids": ["uuid1", "uuid2"] } }
    group_attribute_name VARCHAR(255) DEFAULT 'groups',
    group_mapping JSONB DEFAULT '{}',

    -- Enforcement
    enforce_sso BOOLEAN DEFAULT false,  -- When true, only SSO login allowed (no password)

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One config per protocol per org
    UNIQUE(org_id, protocol)
);

-- Indexes for SSO lookups
CREATE INDEX IF NOT EXISTS idx_sso_config_org ON sso_configurations(org_id);
CREATE INDEX IF NOT EXISTS idx_sso_config_enabled ON sso_configurations(is_enabled) WHERE is_enabled = true;

-- SSO login events (audit trail for SSO logins)
CREATE TABLE IF NOT EXISTS sso_login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    protocol VARCHAR(10) NOT NULL,
    idp_subject_id VARCHAR(255),
    email VARCHAR(255),
    groups_received TEXT[],
    roles_assigned TEXT[],
    was_provisioned BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_events_org ON sso_login_events(org_id);
CREATE INDEX IF NOT EXISTS idx_sso_events_user ON sso_login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_events_created ON sso_login_events(created_at);
