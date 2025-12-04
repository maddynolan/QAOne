-- Migration: Add acceptance_criteria column to requirements table
-- This field stores acceptance criteria for requirements, used when generating test cases

ALTER TABLE requirements 
ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;

-- Add comment
COMMENT ON COLUMN requirements.acceptance_criteria IS 'Acceptance criteria for the requirement, stored as text (one per line)';




