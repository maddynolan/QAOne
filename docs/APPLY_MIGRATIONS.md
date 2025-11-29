# How to Apply Database Migrations

This guide shows you how to apply all database migrations, including the new Phase 2-4 migrations.

## Quick Start (Recommended)

### Option 1: Use the PowerShell Script (Easiest)

The `run_migrations.ps1` script automatically discovers and runs all migrations in order:

```powershell
# From the project root directory
.\run_migrations.ps1
```

This script will:
- Auto-discover all migration files in `supabase/migrations/`
- Run them in numerical order (001, 002, 003, ...)
- Use Docker if `psql` is not available
- Show progress and results for each migration

**Note:** Make sure your PostgreSQL is running and accessible.

---

### Option 2: Manual psql Commands

If you prefer to run migrations manually:

```powershell
# Set PostgreSQL password (adjust if different)
$env:PGPASSWORD = "qaai123"

# Run all migrations in order
psql -h localhost -U qaai -d qaai -f supabase\migrations\001_initial_schema.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\002_ai_generations.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\003_ai_templates.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\004_requirements_table.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\005_fix_ai_generations.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\006_enhance_test_lifecycle.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\007_rag_foundation.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\008_ai_generations_quality_tracking.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\009_model_registry.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\010_add_test_types.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\011_llm_usage_tracking.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\012_multi_tenant_support.sql

# Phase 2-4 New Migrations
psql -h localhost -U qaai -d qaai -f supabase\migrations\013_requirements_embeddings.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\014_recordings.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\015_maintenance_suggestions.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\016_test_jobs.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\017_perf_runs_metrics.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\018_accessibility_issues.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\019_security_findings.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\020_api_keys.sql
psql -h localhost -U qaai -d qaai -f supabase\migrations\021_rbac_audit.sql
```

---

### Option 3: Using Docker

If you're using Docker for PostgreSQL:

```powershell
# Run migrations via Docker exec
Get-Content supabase\migrations\001_initial_schema.sql | docker exec -i qaai-postgres psql -U qaai -d qaai
Get-Content supabase\migrations\002_ai_generations.sql | docker exec -i qaai-postgres psql -U qaai -d qaai
# ... (continue for all migrations)

# Or use the PowerShell script which auto-detects Docker
.\run_migrations.ps1
```

---

### Option 4: Using Supabase Dashboard

If you're using Supabase (cloud or local):

1. Go to **Supabase Dashboard** → **SQL Editor**
2. For each migration file:
   - Open the file from `supabase/migrations/`
   - Copy the entire SQL content
   - Paste into SQL Editor
   - Click **Run**
   - Repeat for all migrations in order

---

## Migration Files List

All migrations (in order):

1. `001_initial_schema.sql` - Initial database schema
2. `002_ai_generations.sql` - AI generations table
3. `003_ai_templates.sql` - AI templates table
4. `004_requirements_table.sql` - Requirements table
5. `005_fix_ai_generations.sql` - Fixes for AI generations
6. `006_enhance_test_lifecycle.sql` - Test lifecycle enhancements
7. `007_rag_foundation.sql` - RAG foundation (pgvector)
8. `008_ai_generations_quality_tracking.sql` - Quality tracking
9. `009_model_registry.sql` - Model registry
10. `010_add_test_types.sql` - Test types
11. `011_llm_usage_tracking.sql` - LLM usage tracking (Phase 1)
12. `012_multi_tenant_support.sql` - Multi-tenant support (Phase 1)
13. **`013_requirements_embeddings.sql`** - Requirements embeddings (Phase 2.1)
14. **`014_recordings.sql`** - DOM recordings (Phase 2.2)
15. **`015_maintenance_suggestions.sql`** - Maintenance suggestions (Phase 2.2)
16. **`016_test_jobs.sql`** - Test execution jobs (Phase 2.3)
17. **`017_perf_runs_metrics.sql`** - Performance runs and metrics (Phase 3.1)
18. **`018_accessibility_issues.sql`** - Accessibility scans and issues (Phase 3.2)
19. **`019_security_findings.sql`** - Security scans and findings (Phase 3.3)
20. **`020_api_keys.sql`** - API keys for plugins (Phase 4.1)
21. **`021_rbac_audit.sql`** - RBAC and audit logs (Phase 4.3)

**Bold** = New migrations from Phase 2-4

---

## Prerequisites

Before running migrations:

1. **PostgreSQL must be running**
   - Local: Make sure PostgreSQL service is running
   - Docker: `docker ps` should show your PostgreSQL container
   - Supabase: Your project should be active

2. **Database and user must exist**
   ```sql
   CREATE DATABASE qaai;
   CREATE USER qaai WITH PASSWORD 'qaai123';
   GRANT ALL PRIVILEGES ON DATABASE qaai TO qaai;
   ```

3. **pgvector extension** (for embeddings)
   - Migration `007_rag_foundation.sql` will create this
   - Or manually: `CREATE EXTENSION IF NOT EXISTS vector;`

4. **Connection details** in `backend/.env`:
   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=qaai
   POSTGRES_USER=qaai
   POSTGRES_PASSWORD=qaai123
   DATABASE_URL=postgresql://qaai:qaai123@localhost:5432/qaai
   ```

---

## Verify Migrations

After running migrations, verify they were applied:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check specific new tables
SELECT * FROM requirement_embeddings LIMIT 1;
SELECT * FROM recordings LIMIT 1;
SELECT * FROM test_jobs LIMIT 1;
SELECT * FROM perf_runs LIMIT 1;
SELECT * FROM accessibility_issues LIMIT 1;
SELECT * FROM security_findings LIMIT 1;
SELECT * FROM api_keys LIMIT 1;
SELECT * FROM roles LIMIT 1;
```

Or test via API:
```powershell
# Test database connection
curl http://localhost:8000/health/database
```

---

## Troubleshooting

### Error: "relation already exists"
- Some migrations use `CREATE TABLE IF NOT EXISTS`, so this is safe to ignore
- Or the migration was already applied

### Error: "extension vector does not exist"
- Make sure PostgreSQL has pgvector extension installed
- For Docker: Use `pgvector/pgvector:pg16` image
- For local: Install pgvector extension

### Error: "permission denied"
- Make sure the database user has proper permissions
- Run: `GRANT ALL PRIVILEGES ON DATABASE qaai TO qaai;`

### Error: "connection refused"
- Check PostgreSQL is running: `docker ps` or check Windows services
- Verify connection details in `.env`
- Check firewall/port blocking

### Migration fails partway through
- Check which migration failed
- Fix the issue (usually a missing dependency)
- Re-run from the failed migration onwards
- Some migrations can be safely re-run (they use `IF NOT EXISTS`)

---

## Next Steps

After migrations are complete:

1. **Restart backend server** to load new schema
2. **Test API endpoints** - All new agents should work
3. **Verify functionality** - Try creating a requirement, running a test, etc.

---

## Quick Reference

```powershell
# One-liner to run all migrations (if psql is in PATH)
$env:PGPASSWORD = "qaai123"; Get-ChildItem supabase\migrations\*.sql | Sort-Object Name | ForEach-Object { Write-Host "Running $($_.Name)..."; psql -h localhost -U qaai -d qaai -f $_.FullName }
```



