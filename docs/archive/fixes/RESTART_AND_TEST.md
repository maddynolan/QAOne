# Restart Server and Test - Step by Step

## Issue
Create operations return fallback IDs like `tc_1762133729` instead of real database IDs.

## Root Cause
The server needs to reload to pick up the latest code changes that:
- Remove fallback ID returns
- Add proper error messages
- Check pool connection correctly

## Steps to Fix

### 1. Stop the Current Server
Look at the terminal where uvicorn is running and press `Ctrl+C`

### 2. Clear Python Cache
```powershell
Remove-Item -Path "backend\app\__pycache__" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "backend\app\services\__pycache__" -Recurse -Force -ErrorAction SilentlyContinue
```

### 3. Restart Server
```powershell
cd backend
venv_new\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Test Create Operation
Try creating a test case again. You should now see either:
- ✅ **SUCCESS**: Real UUID like `{"id":"550e8400-e29b-41d4-a716-446655440010"}`
- ❌ **ERROR**: HTTP 500 with detailed error message

### 5. Check Server Logs
Look for these messages in the uvicorn terminal:
- `get_database_client returned: <class 'psycopg2.pool.ThreadedConnectionPool'>`
- `Pool type check - has_getconn: True, has_table: False`
- `Successfully created test case with ID: ...`

### 6. If Still Getting Fallback IDs
Check server logs for:
- "Pool type check - has_getconn: False" → Pool detection issue
- "No database connection available" → Connection pool not created
- "Database insert failed" → Actual database error

## Expected Behavior After Fix

**Before**: `{"id":"tc_1762133729"}` (fallback, nothing saved)

**After**: 
- Success: `{"id":"550e8400-e29b-41d4-a716-446655440010"}` (real UUID)
- Error: `{"detail":"Database error: ..."}` (specific error to fix)

## Verify in Database
After successful create:
```powershell
docker exec qa-postgres psql -U qaai -d qaai -c "SELECT id::text, title FROM test_cases ORDER BY created_at DESC LIMIT 5;"
```

You should see your newly created test case with a real UUID.


