-- Migration: Fix ai_generations table to match document recommendations
-- 1. Add task field for categorization
-- 2. Optionally convert output to JSONB (safer: keep both for now)

-- Add task field if it doesn't exist
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS task VARCHAR(100);

-- Create index for task field
CREATE INDEX IF NOT EXISTS idx_ai_generations_task ON ai_generations(task);

-- Add output_jsonb column for future JSONB usage (safer migration)
-- Keep original output column for compatibility
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS output_jsonb JSONB;

-- For new records, we'll populate both. For old records, can migrate later:
-- UPDATE ai_generations SET output_jsonb = output::jsonb WHERE output IS NOT NULL AND output_jsonb IS NULL;

-- Create index on JSONB column for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_generations_output_jsonb ON ai_generations USING GIN (output_jsonb);

-- Note: To fully migrate to JSONB-only in future:
-- 1. Ensure all new records populate output_jsonb
-- 2. Backfill: UPDATE ai_generations SET output_jsonb = output::jsonb WHERE output_jsonb IS NULL;
-- 3. After verification, drop output column: ALTER TABLE ai_generations DROP COLUMN output;
-- 4. Rename: ALTER TABLE ai_generations RENAME COLUMN output_jsonb TO output;

