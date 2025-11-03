# QA AI Platform Setup Guide

## Database Setup

### Option 1: Docker PostgreSQL (Local Development)

Run PostgreSQL in Docker:

```bash
docker run -d --name qa-postgres \
  -e POSTGRES_PASSWORD=qaai123 \
  -e POSTGRES_USER=qaai \
  -e POSTGRES_DB=qaai \
  -p 5432:5432 \
  postgres:16
```

Connection string: `postgres://qaai:qaai123@localhost:5432/qaai`

### Option 2: Supabase (Recommended for Production)

1. Create account at https://supabase.com
2. Create a new project
3. Get your project URL and API key
4. Set environment variables:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_KEY=your-supabase-anon-key
```

### Running Migrations

#### For Supabase:
1. Use Supabase Dashboard → SQL Editor
2. Copy and paste each migration file:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_ai_generations.sql`
   - `supabase/migrations/003_ai_templates.sql`
   - `supabase/migrations/004_requirements_table.sql`
   - `supabase/migrations/005_fix_ai_generations.sql`

3. Run each migration in order

#### For Local PostgreSQL:
```bash
psql -h localhost -U qaai -d qaai -f supabase/migrations/001_initial_schema.sql
psql -h localhost -U qaai -d qaai -f supabase/migrations/002_ai_generations.sql
psql -h localhost -U qaai -d qaai -f supabase/migrations/003_ai_templates.sql
psql -h localhost -U qaai -d qaai -f supabase/migrations/004_requirements_table.sql
psql -h localhost -U qaai -d qaai -f supabase/migrations/005_fix_ai_generations.sql
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Ollama Configuration (DGX)
OLLAMA_URL=http://<dgx-ip>:11434

# Supabase/PostgreSQL Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# Database Connection (if using direct PostgreSQL)
DATABASE_URL=postgres://qaai:qaai123@localhost:5432/qaai

# AI Generations Log (fallback if database not configured)
AI_GENERATIONS_LOG=ai_generations.jsonl

# Backend API
VITE_API_BASE_URL=http://localhost:8001
```

## Starting the Servers

### Backend
```bash
cd backend
venv_new\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Frontend
```bash
npm run dev
```

## Verification

1. Check backend health: `http://localhost:8001/health`
2. Check frontend: `http://localhost:8080`
3. Test AI endpoint: POST to `http://localhost:8001/ai/jira-to-testcases`

## Database Schema Overview

- **organizations** - Top-level tenants
- **projects** - Projects within organizations
- **requirements** - Jira stories/requirements (NEW)
- **test_cases** - Test cases (manual/automated)
- **test_runs** - Test execution runs
- **test_run_steps** - Individual test results
- **artifacts** - Screenshots, videos, logs
- **ai_generations** - All LLM calls for fine-tuning
- **ai_templates** - Prompt templates
- **triage_analysis** - AI failure analysis
- **defects** - Defect tracking

