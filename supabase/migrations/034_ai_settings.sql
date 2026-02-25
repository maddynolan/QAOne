-- AI Settings: Per-org and per-project AI configuration with BYOK key support
-- Supports multi-level toggle hierarchy: server env → org → project → feature

CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID,  -- NULL = org-wide default settings
  enabled BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'openai',  -- openai, anthropic, azure_openai, ollama, custom
  model TEXT DEFAULT 'gpt-4o-mini',
  -- Encrypted API key references (stored in secrets table via Fernet encryption)
  api_key_secret_id UUID,       -- OpenAI / primary provider key
  anthropic_key_secret_id UUID, -- Anthropic Claude key
  custom_endpoint TEXT,          -- For Azure OpenAI or self-hosted endpoints
  -- Budget controls
  max_requests_per_day INT DEFAULT 1000,
  max_cost_per_day_cents INT DEFAULT 1000,  -- $10.00 default
  requests_today INT DEFAULT 0,
  cost_today_cents INT DEFAULT 0,
  budget_reset_at TIMESTAMPTZ DEFAULT NOW(),
  budget_tracking BOOLEAN DEFAULT true,
  -- Feature toggles (array of enabled feature IDs)
  enabled_features JSONB DEFAULT '[]'::jsonb,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one settings row per org/project combo
-- Uses COALESCE to treat NULL project_id as a sentinel value for org-wide settings
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_settings_org_project
  ON ai_settings(org_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_ai_settings_org ON ai_settings(org_id);

-- Usage tracking table for daily AI usage per org
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  project_id UUID,
  provider TEXT NOT NULL,
  model TEXT,
  endpoint TEXT,         -- Which API endpoint triggered this
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  cost_cents INT DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_date ON ai_usage_log(org_id, created_at);
