-- Migration: Make Audit Logs Immutable
-- Tier-0 Feature: Immutable Audit Trail for Compliance
-- Prevents any modifications to audit logs for non-repudiation

-- Add hash column for integrity verification
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS hash VARCHAR(64);

-- Create function to generate hash
CREATE OR REPLACE FUNCTION generate_audit_hash(
    tenant_id VARCHAR,
    user_id VARCHAR,
    action VARCHAR,
    resource_type VARCHAR,
    resource_id VARCHAR,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(
        digest(
            COALESCE(tenant_id, '') || '|' ||
            COALESCE(user_id, '') || '|' ||
            COALESCE(action, '') || '|' ||
            COALESCE(resource_type, '') || '|' ||
            COALESCE(resource_id, '') || '|' ||
            COALESCE(details::TEXT, '{}') || '|' ||
            COALESCE(created_at::TEXT, ''),
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate hash on insert
CREATE OR REPLACE FUNCTION set_audit_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.hash = generate_audit_hash(
        NEW.tenant_id,
        NEW.user_id,
        NEW.action,
        NEW.resource_type,
        NEW.resource_id,
        NEW.details,
        NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_hash_trigger ON audit_logs;
CREATE TRIGGER audit_hash_trigger
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_hash();

-- Prevent updates to audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_updates()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_immutable_trigger ON audit_logs;
CREATE TRIGGER audit_immutable_trigger
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_updates();

-- Create index on hash for integrity verification
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash ON audit_logs(hash);

-- Add retention policy function (optional - for automatic cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Note: This function is for reference only
    -- In production, use scheduled jobs or external tools
    -- We don't actually delete, but mark for archival
    
    -- For now, just return 0 (no deletion)
    -- In production, you might:
    -- 1. Archive to cold storage
    -- 2. Move to separate audit archive table
    -- 3. Export to external system
    
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE audit_logs IS 'Immutable audit trail - all actions are logged and cannot be modified';
COMMENT ON COLUMN audit_logs.hash IS 'SHA-256 hash for integrity verification';
COMMENT ON FUNCTION prevent_audit_updates() IS 'Prevents any updates or deletes to audit logs';

-- Create view for audit log verification
CREATE OR REPLACE VIEW audit_logs_verified AS
SELECT 
    *,
    hash = generate_audit_hash(
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        created_at
    ) AS hash_valid
FROM audit_logs;

COMMENT ON VIEW audit_logs_verified IS 'View to verify audit log integrity using hash';

