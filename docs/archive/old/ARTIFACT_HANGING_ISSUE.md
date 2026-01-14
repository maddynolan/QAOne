# Artifact Generation Hanging Issue

## Problem
Artifacts are not generating after 2+ minutes. Last successful generation was at 11:34:38 AM.

## Root Cause Analysis

### Issue 1: Scenario Generator Creating 0 Scenarios
**Log Evidence**:
```
2025-12-05 11:34:38,965 - Segmented 35 edges into 0 scenarios
```

**Impact**: When 0 scenarios are generated, the code should fall back to deterministic engine, but it may be hanging during the fallback.

### Issue 2: LLM Calls May Be Hanging
The test case generation uses LLM calls with timeouts:
- Per scenario: 35 seconds timeout
- Overall: 300 seconds (5 minutes) timeout

If LLM is not responding or Ollama is not available, these calls can hang until timeout.

### Issue 3: No Recent stop_session Calls
The logs don't show any recent `stop_session` calls after 12:32 PM. This suggests either:
1. The stop_session endpoint wasn't called
2. The call is hanging before logging starts
3. The logs are not being written

## Immediate Fixes Needed

### Fix 1: Add Better Logging for Fallback
When scenario generator creates 0 scenarios, add immediate logging before fallback:

```python
if not scenarios:
    logger.warning("No scenarios generated from skeleton generator, falling back to deterministic engine")
    logger.info("Starting deterministic test case generation...")
    raise ValueError("No scenarios generated")
```

### Fix 2: Add Timeout to Deterministic Engine
The deterministic engine fallback may not have proper timeouts. Add timeout wrapper:

```python
try:
    automated_result = await asyncio.wait_for(
        generate_automated_test_case(),
        timeout=60.0  # 60 second timeout
    )
except asyncio.TimeoutError:
    logger.error("Deterministic engine timed out")
    automated_result = None
```

### Fix 3: Check LLM Availability
Before making LLM calls, check if Ollama/OpenAI is available:

```python
if not self.ollama_service.is_available():
    logger.warning("Ollama not available, skipping LLM rewrite")
    raise ValueError("LLM not available")
```

## Debugging Steps

1. **Check if stop_session was called**:
   ```bash
   Get-Content logs\app.log | Select-String -Pattern "stop_session|POST.*stop" | Select-Object -Last 10
   ```

2. **Check for hanging LLM calls**:
   ```bash
   Get-Content logs\app.log | Select-String -Pattern "rewrite_test_case|Ollama|OpenAI|timeout" | Select-Object -Last 20
   ```

3. **Check scenario generator output**:
   ```bash
   Get-Content logs\app.log | Select-String -Pattern "Segmented.*edges.*scenarios|scenario.*skeleton" | Select-Object -Last 10
   ```

4. **Check if deterministic engine is running**:
   ```bash
   Get-Content logs\app.log | Select-String -Pattern "deterministic|generate_automated|generate_manual" | Select-Object -Last 10
   ```

## Quick Fix: Disable LLM Rewrite Temporarily

To bypass LLM hanging, set environment variable:
```bash
$env:USE_LLM_REWRITE="false"
```

Or modify code to skip LLM rewrite if scenarios = 0:
```python
if not scenarios or len(scenarios) == 0:
    logger.warning("No scenarios, skipping LLM rewrite and using deterministic engine")
    # Skip LLM rewrite entirely
    use_llm_rewrite = False
```

## Next Steps

1. Add the logging and timeout fixes above
2. Test with a new session
3. Monitor logs for where it's hanging
4. If LLM is the issue, disable LLM rewrite temporarily


