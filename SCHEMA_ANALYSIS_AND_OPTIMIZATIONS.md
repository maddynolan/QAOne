# Schema Analysis & Optimization Recommendations

## ✅ What We've Successfully Incorporated

### Core Database Schema (Mostly Complete)
1. **✅ Organizations & Projects** - Fully implemented in `001_initial_schema.sql`
2. **✅ Test Cases** - Implemented with proper JSONB for steps
3. **✅ Test Runs** - Implemented with status tracking
4. **✅ AI Generations** - Created in `002_ai_generations.sql`
5. **✅ AI Templates** - Created in `003_ai_templates.sql`
6. **✅ Test Run Steps** - We have `test_run_steps` (similar to doc's `test_run_results`)
7. **✅ Artifacts** - Separate artifacts table exists

### UI Integration Points
1. **✅ Test Cases Page** - "Generate with AI" button working
2. **✅ Triage Page** - "Analyze with AI" button working  
3. **✅ Settings - AI Templates** - Prompt editor implemented

## ⚠️ Gaps & Issues to Fix

### 1. Missing: `requirements` Table
**Document Recommendation:**
```sql
CREATE TABLE requirements (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    source TEXT, -- 'jira', 'manual', 'github'
    source_ref TEXT, -- 'jira key', 'issue id'
    title TEXT,
    description TEXT,
    raw_payload JSONB, -- full jira json
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Why Important:**
- Tracks where test cases came from (Jira, manual, etc.)
- Links test cases back to original requirements
- Stores full Jira JSON for context

**Action Required:** Create migration `004_requirements_table.sql`

### 2. Schema Mismatch: `ai_generations` Table
**Document Recommendation:**
```sql
CREATE TABLE ai_generations (
    id UUID PRIMARY KEY,
    project_id UUID,
    task TEXT, -- 'jira-to-tests', 'tests-to-playwright', 'triage'
    model TEXT,
    prompt TEXT,
    output JSONB, -- ⚠️ Should be JSONB, not TEXT
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Current Implementation Issues:**
- ❌ Missing `task` field
- ❌ `output` is TEXT instead of JSONB
- ✅ Has extra fields: `mode`, `endpoint`, `latency_ms` (these are good!)

**Action Required:** Create migration `005_fix_ai_generations.sql`

### 3. Schema Alignment: `test_run_results` vs `test_run_steps`
**Document Recommendation:**
```sql
CREATE TABLE test_run_results (
    id UUID PRIMARY KEY,
    run_id UUID REFERENCES test_runs(id),
    test_case_id UUID REFERENCES test_cases(id),
    status TEXT, -- 'passed', 'failed', 'skipped'
    logs TEXT,
    artifacts JSONB, -- {screenshot, video, report links}
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Current Implementation:**
- ✅ We have `test_run_steps` with similar structure
- ⚠️ Our artifacts are in separate table (better design!)
- ⚠️ Field names differ (`case_id` vs `test_case_id`, `error_message` vs `logs`)

**Recommendation:** Keep our current design (better normalized), but ensure compatibility

### 4. Missing: Docker Setup Instructions
**Document Recommendation:**
```bash
docker run -d --name qa-postgres \
  -e POSTGRES_PASSWORD=qaai123 \
  -e POSTGRES_USER=qaai \
  -e POSTGRES_DB=qaai \
  -p 5432:5432 postgres:16
```

**Current Status:** You're using Supabase (hosted Postgres), which is fine, but local Docker setup not documented.

**Action Required:** Add `SETUP.md` with Docker instructions for local development

## 🚀 Optimizations Needed (Priority Order)

### Priority 1: Critical Fixes
1. **Add `requirements` table** - Needed for Jira integration
2. **Fix `ai_generations.output` to JSONB** - Better querying and validation
3. **Add `task` field to `ai_generations`** - Better categorization

### Priority 2: Database Connection
1. **Proper PostgreSQL connection in backend** - Currently using Supabase client or file logging
2. **Run migrations** - Ensure all tables are created
3. **Test database connectivity** - Verify ai_storage works

### Priority 3: Future Optimizations (From Document)
1. **Redis Integration** - For:
   - Caching last AI responses
   - Queueing batch generation ("Generate 25 test cases")
   - Rate limiting per organization
2. **S3/MinIO for Artifacts** - For:
   - Test run screenshots/videos
   - Performance test results (k6 JSON)
   - Large log files
3. **pgvector Extension** - For:
   - Similar test retrieval
   - Semantic search
4. **Move to Neon/RDS** - When ready for production hosting

## 📋 Recommended Action Items

### Immediate (This Week)
1. ✅ Backend is running - DONE
2. ⏳ Create `004_requirements_table.sql` migration
3. ⏳ Create `005_fix_ai_generations.sql` migration  
4. ⏳ Update `ai_storage.py` to handle JSONB
5. ⏳ Test database connection and storage

### Short Term (Next 2 Weeks)
1. ⏳ Implement requirements tracking in UI
2. ⏳ Add Jira integration to store in requirements table
3. ⏳ Dashboard queries for test counts and success rates
4. ⏳ Test run results properly stored in database

### Long Term (Next Month)
1. ⏳ Redis integration for caching/queuing
2. ⏳ S3/MinIO for artifact storage
3. ⏳ pgvector for similarity search
4. ⏳ Production database setup (Neon/RDS)

## 📝 SQL Migrations to Create

### Migration 004: Requirements Table
```sql
CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'jira', 'manual', 'github', 'api'
    source_ref TEXT, -- 'jira key', 'issue id', etc.
    title TEXT NOT NULL,
    description TEXT,
    raw_payload JSONB, -- Full Jira JSON or other source data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_requirements_project_id ON requirements(project_id);
CREATE INDEX idx_requirements_source ON requirements(source);
```

### Migration 005: Fix AI Generations
```sql
-- Add task field
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS task VARCHAR(100);

-- Change output to JSONB (requires migration strategy)
-- Option 1: Create new column, migrate data, drop old
ALTER TABLE ai_generations ADD COLUMN output_jsonb JSONB;
UPDATE ai_generations SET output_jsonb = output::jsonb WHERE output IS NOT NULL;
ALTER TABLE ai_generations DROP COLUMN output;
ALTER TABLE ai_generations RENAME COLUMN output_jsonb TO output;

-- Or simpler: just add task and leave output as TEXT for now
CREATE INDEX IF NOT EXISTS idx_ai_generations_task ON ai_generations(task);
```

## ✅ Current Status Summary

**What's Good:**
- Core schema is solid and well-designed
- AI generation storage is implemented
- UI integration points are working
- Better normalization than document (separate artifacts table)

**What Needs Work:**
- Missing requirements table
- ai_generations needs schema fixes
- Database connection needs verification
- Missing some optimization layers (Redis, S3)

**Overall Assessment:** 
**7/10** - Good foundation, needs schema fixes and optimizations for production readiness.


