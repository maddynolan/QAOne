#!/usr/bin/env python3
"""Create element_models table without foreign key dependencies"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def create_table():
    from app.services.storage.postgres_direct import get_postgres_pool
    
    pool = get_postgres_pool()
    if not pool:
        print("❌ Database connection pool not available")
        return False
    
    sql = """
-- Create element_models table (simplified, no foreign keys)
CREATE TABLE IF NOT EXISTS element_models (
    element_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_name VARCHAR(255) NOT NULL,
    element_type VARCHAR(50) NOT NULL,
    page_id UUID,  -- No foreign key constraint
    application_type VARCHAR(50) NOT NULL DEFAULT 'generic',
    identifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    visual_fingerprint TEXT,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id UUID,  -- No foreign key constraint
    created_by UUID  -- No foreign key constraint
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_element_models_page ON element_models(page_id);
CREATE INDEX IF NOT EXISTS idx_element_models_app_type ON element_models(application_type);
CREATE INDEX IF NOT EXISTS idx_element_models_tenant ON element_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_element_models_identifiers ON element_models USING GIN(identifiers);
CREATE INDEX IF NOT EXISTS idx_element_models_name ON element_models(element_name);

-- Create element_model_usage table
CREATE TABLE IF NOT EXISTS element_model_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id UUID,  -- No foreign key constraint
    test_case_id UUID,  -- No foreign key constraint
    identifier_used VARCHAR(50),
    identifier_index INTEGER,
    success BOOLEAN DEFAULT true,
    execution_time_ms INTEGER,
    error_message TEXT,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id UUID  -- No foreign key constraint
);

-- Create indexes for usage table
CREATE INDEX IF NOT EXISTS idx_element_usage_element ON element_model_usage(element_id);
CREATE INDEX IF NOT EXISTS idx_element_usage_test_case ON element_model_usage(test_case_id);
CREATE INDEX IF NOT EXISTS idx_element_usage_tenant ON element_model_usage(tenant_id);
"""
    
    try:
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                conn.commit()
                print("✅ element_models table created successfully")
                return True
        finally:
            pool.putconn(conn)
    except Exception as e:
        error_str = str(e).lower()
        if 'already exists' in error_str:
            print("⚠️  Table already exists (OK)")
            return True
        else:
            print(f"❌ Failed: {e}")
            return False

if __name__ == "__main__":
    success = asyncio.run(create_table())
    sys.exit(0 if success else 1)


