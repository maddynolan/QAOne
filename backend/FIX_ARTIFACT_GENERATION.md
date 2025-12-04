# Fix for Artifact Generation Issues

## Issues Found

### 1. OpenAI API Key Not Found
**Problem**: `OPENAI_API_KEY not set - OpenAI service will not be available`

**Root Cause**: The `OPENAI_API_KEY` is not in the `.env` file.

**Solution**:
1. Add to `backend/.env` file:
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   TEST_CASE_LLM_PROVIDER=auto
   ```

2. Restart the backend server to load the new environment variable.

### 2. Ollama Calls Hanging
**Problem**: All 9 scenario rewrites started but none completed, causing 5-minute timeout.

**Root Cause**: 
- Ollama 7B model calls are hanging (no response)
- No explicit timeout wrapper on individual calls
- All scenarios processed in parallel, all hanging simultaneously

**Solution Applied**:
- Added explicit `asyncio.wait_for()` timeout wrapper (30s per scenario)
- This will prevent individual calls from hanging indefinitely

**Additional Checks Needed**:
1. Verify Ollama server is running: `http://localhost:31143`
2. Check if 7B model is available: `curl http://localhost:31143/api/tags`
3. Test a simple Ollama call to see if it responds

### 3. Artifacts Not Generated
**Problem**: All artifacts timed out because LLM calls hung.

**Root Cause**: Cascading failure - test case generation timed out, so no artifacts were generated.

**Solution**: Once timeouts are fixed, artifacts should generate properly.

## Fixes Applied

1. ✅ **OpenAI Service**: Added `.env` file loading on initialization
2. ✅ **Timeout Wrapper**: Added explicit `asyncio.wait_for()` with 30s timeout per scenario
3. ✅ **Better Error Handling**: Improved logging and error messages

## Next Steps

1. **Add OpenAI API Key to .env**:
   ```bash
   # In backend/.env file
   OPENAI_API_KEY=sk-your-actual-key-here
   TEST_CASE_LLM_PROVIDER=auto
   ```

2. **Install OpenAI Package** (if not installed):
   ```bash
   pip install openai
   ```

3. **Restart Backend** to load new environment variables

4. **Check Ollama Server**:
   ```bash
   # Verify Ollama is running
   curl http://localhost:31143/api/tags
   
   # Check if 7B model is available
   # Should see: qwen2.5-coder:7b
   ```

5. **Test Again**: Try generating artifacts again

## Expected Behavior After Fix

- If `OPENAI_API_KEY` is set: Uses OpenAI gpt-4o-mini (fast, ~1-2s per scenario)
- If `OPENAI_API_KEY` is not set: Falls back to Ollama 7B (slower, ~2-5s per scenario)
- Each scenario has 30s timeout (prevents hanging)
- Artifacts should generate successfully

## Debugging

If artifacts still don't generate:

1. Check logs for:
   - `Using OpenAI (gpt-4o-mini)` - confirms OpenAI is being used
   - `Using Ollama` - confirms fallback to Ollama
   - `Ollama rewrite timed out` - indicates Ollama server issue
   - `OpenAI rewrite failed` - indicates API key or network issue

2. Test Ollama manually:
   ```bash
   curl http://localhost:31143/api/generate -d '{
     "model": "qwen2.5-coder:7b",
     "prompt": "Hello",
     "stream": false
   }'
   ```

3. Test OpenAI manually:
   ```python
   from openai import OpenAI
   client = OpenAI(api_key="sk-your-key")
   response = client.chat.completions.create(
       model="gpt-4o-mini",
       messages=[{"role": "user", "content": "Hello"}]
   )
   print(response.choices[0].message.content)
   ```




