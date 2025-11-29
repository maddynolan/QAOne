-- Migration: Secrets Management
-- Encrypted storage for API keys, passwords, and sensitive test data

-- 1. Create secrets table
CREATE TABLE IF NOT EXISTS secrets (
    secret_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    secret_type VARCHAR(50) NOT NULL, -- 'api_key', 'password', 'token', 'credential', 'custom'
    encrypted_value BYTEA NOT NULL, -- Encrypted using pgcrypto
    encryption_key_id VARCHAR(255), -- Reference to key used for encryption
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(org_id, project_id, name)
);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_secrets_org_project ON secrets(org_id, project_id);
CREATE INDEX IF NOT EXISTS idx_secrets_tenant ON secrets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_secrets_type ON secrets(secret_type);

-- 3. Enable Row-Level Security
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY secrets_tenant_isolation ON secrets
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR tenant_id IS NULL);

CREATE POLICY secrets_org_access ON secrets
    FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM user_org_memberships
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- 5. Create function to encrypt secrets (using pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION encrypt_secret(
    plaintext TEXT,
    key TEXT DEFAULT current_setting('app.encryption_key', true)
) RETURNS BYTEA AS $$
BEGIN
    IF key IS NULL OR key = '' THEN
        RAISE EXCEPTION 'Encryption key not configured';
    END IF;
    RETURN pgp_sym_encrypt(plaintext, key);
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to decrypt secrets
CREATE OR REPLACE FUNCTION decrypt_secret(
    encrypted_value BYTEA,
    key TEXT DEFAULT current_setting('app.encryption_key', true)
) RETURNS TEXT AS $$
BEGIN
    IF key IS NULL OR key = '' THEN
        RAISE EXCEPTION 'Decryption key not configured';
    END IF;
    RETURN pgp_sym_decrypt(encrypted_value, key);
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER secrets_updated_at
    BEFORE UPDATE ON secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_secrets_updated_at();

-- 8. Create view for decrypted secrets (with permission checks)
CREATE OR REPLACE VIEW secrets_decrypted AS
SELECT
    secret_id,
    org_id,
    project_id,
    name,
    description,
    secret_type,
    decrypt_secret(encrypted_value) as decrypted_value,
    encryption_key_id,
    created_at,
    updated_at,
    created_by,
    tenant_id
FROM secrets
WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
   OR tenant_id IS NULL;

-- 9. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON secrets TO authenticated;
GRANT SELECT ON secrets_decrypted TO authenticated;

COMMENT ON TABLE secrets IS 'Encrypted storage for API keys, passwords, and sensitive test data';
COMMENT ON COLUMN secrets.encrypted_value IS 'Encrypted using pgcrypto pgp_sym_encrypt';
COMMENT ON FUNCTION encrypt_secret IS 'Encrypts a secret value using pgcrypto';
COMMENT ON FUNCTION decrypt_secret IS 'Decrypts a secret value using pgcrypto';

