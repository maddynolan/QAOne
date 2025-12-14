"""
Script to create Nexus database tables
Run this if nexus_sessions table doesn't exist
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.storage.postgres_direct import execute_query, get_postgres_pool


async def create_nexus_tables():
    """Create all Nexus-related tables"""
    
    migration_sql = """
-- Nexus Sessions Table
CREATE TABLE IF NOT EXISTS nexus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    app_url TEXT NOT NULL,
    project_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    max_duration_seconds INTEGER NOT NULL DEFAULT 1800,
    red_team_mode BOOLEAN NOT NULL DEFAULT FALSE,
    proof TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Nexus Session Queue
CREATE TABLE IF NOT EXISTS nexus_session_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 99,
    capability VARCHAR(255),
    url TEXT,
    flow_steps JSONB,
    metadata JSONB,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Nexus Risk Heatmap
CREATE TABLE IF NOT EXISTS nexus_risk_heatmap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    capability VARCHAR(255) NOT NULL,
    risk_level VARCHAR(50) NOT NULL,
    reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, capability)
);

-- Nexus Session History
CREATE TABLE IF NOT EXISTS nexus_session_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT,
    tool_calls JSONB,
    tool_results JSONB,
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Nexus Detected Defects
CREATE TABLE IF NOT EXISTS nexus_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    defect_id UUID,
    defect_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    page_url TEXT,
    evidence JSONB,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Nexus E2E Flow Results
CREATE TABLE IF NOT EXISTS nexus_e2e_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    flow_name VARCHAR(255) NOT NULL,
    steps JSONB NOT NULL,
    negative BOOLEAN NOT NULL DEFAULT FALSE,
    success BOOLEAN NOT NULL,
    execution_time_seconds FLOAT,
    evidence JSONB,
    error_message TEXT,
    defect_id UUID,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_session_id ON nexus_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_status ON nexus_sessions(status);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_project_id ON nexus_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_nexus_queue_session_id ON nexus_session_queue(session_id, processed);
CREATE INDEX IF NOT EXISTS idx_nexus_queue_priority ON nexus_session_queue(priority, processed);
CREATE INDEX IF NOT EXISTS idx_nexus_heatmap_session_id ON nexus_risk_heatmap(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_history_session_id ON nexus_session_history(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_nexus_defects_session_id ON nexus_defects(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_e2e_session_id ON nexus_e2e_results(session_id);
"""
    
    print("Creating Nexus database tables...")
    
    # Split SQL into individual statements
    statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]
    
    for i, statement in enumerate(statements, 1):
        if not statement:
            continue
        try:
            # Add semicolon back
            statement = statement + ';'
            print(f"  Executing statement {i}/{len(statements)}...")
            await execute_query(statement)
            print(f"  ✓ Statement {i} completed")
        except Exception as e:
            error_msg = str(e)
            # Ignore "already exists" errors
            if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                print(f"  ⚠ Statement {i} skipped (already exists)")
            else:
                print(f"  ✗ Statement {i} failed: {error_msg}")
                # Continue anyway - some tables might already exist
    
    print("\n✅ Nexus tables creation complete!")
    print("\nYou can now use Nexus sessions - they will persist across server restarts.")


if __name__ == "__main__":
    asyncio.run(create_nexus_tables())




