-- Migration: Add quality tracking columns to ai_generations for fine-tuning data collection
-- Enables users to rate generations and provide corrections for training data

ALTER TABLE ai_generations 
    ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS feedback TEXT,
    ADD COLUMN IF NOT EXISTS corrected_output TEXT,
    ADD COLUMN IF NOT EXISTS task_category VARCHAR(50), -- 'manual', 'api', 'automation', 'triage', etc.
    ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(20), -- 'simple', 'medium', 'complex'
    ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array of tags for filtering
    ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for quality filtering
CREATE INDEX IF NOT EXISTS idx_ai_generations_quality_score ON ai_generations(quality_score) WHERE quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_generations_is_approved ON ai_generations(is_approved) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_ai_generations_task_category ON ai_generations(task_category) WHERE task_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_generations_has_correction ON ai_generations(corrected_output) WHERE corrected_output IS NOT NULL;

-- Create composite index for training data export queries
CREATE INDEX IF NOT EXISTS idx_ai_generations_training_data 
    ON ai_generations(quality_score, is_approved, task_category, created_at) 
    WHERE quality_score >= 4 OR is_approved = true OR corrected_output IS NOT NULL;

COMMENT ON COLUMN ai_generations.quality_score IS 'User rating 1-5 stars for generation quality';
COMMENT ON COLUMN ai_generations.is_approved IS 'Whether user approved this generation for use';
COMMENT ON COLUMN ai_generations.feedback IS 'User feedback or comments about the generation';
COMMENT ON COLUMN ai_generations.corrected_output IS 'User-corrected version of the output (valuable for training)';
COMMENT ON COLUMN ai_generations.task_category IS 'Category of QA task (manual, api, automation, triage, etc.)';
COMMENT ON COLUMN ai_generations.complexity_level IS 'Complexity of the input requirement';
COMMENT ON COLUMN ai_generations.tags IS 'Tags for filtering and organizing training data';


