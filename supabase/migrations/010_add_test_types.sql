-- Add accessibility and security to test_type enum
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE
-- If these values already exist, the migration will fail gracefully
DO $$ 
BEGIN
    -- Check if 'accessibility' exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'accessibility' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'test_type')
    ) THEN
        ALTER TYPE test_type ADD VALUE 'accessibility';
    END IF;
    
    -- Check if 'security' exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'security' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'test_type')
    ) THEN
        ALTER TYPE test_type ADD VALUE 'security';
    END IF;
END $$;

