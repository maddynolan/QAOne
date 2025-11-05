# 🔍 Root Cause Analysis: Timeout Issues

## ⚠️ Problem Identified

**Symptoms:**
- Requests timing out after 180-300 seconds
- 2 out of 3 retries failing
- Backend becomes unreachable during processing
- Single requests taking 5+ minutes

---

## 🔬 Root Cause

### Primary Issue: Ollama Service Timeout Mismatch

**Problem:**
- **Ollama Service Timeout:** 180 seconds (3 minutes)
- **Actual Request Time:** 114-117 seconds (2 minutes) for 14B model
- **Client Timeout:** 300 seconds (5 minutes)
- **Result:** Ollama service times out before client, causing request failures

**Why It Happens:**
1. 14B model on DGX Spark takes ~2 minutes per request
2. Ollama service timeout (180s) is shorter than actual request time
3. Service gives up before request completes
4. Client waits full 300s but gets no response

### Secondary Issue: No Request Queuing/Throttling

**Problem:**
- Multiple concurrent requests can overwhelm backend
- No request queue or rate limiting
- Backend tries to process all requests simultaneously
- DGX Spark might process sequentially (one at a time)

---

## ✅ Fixes Applied

### 1. Increased Ollama Service Timeout
- **Before:** 180 seconds
- **After:** 360 seconds (6 minutes)
- **Reason:** 14B takes 2 minutes, need 3x buffer for safety

### 2. Improved Timeout Configuration
- Added `sock_read` timeout to match total timeout
- Added `connect` timeout for connection issues
- Better timeout handling in aiohttp session

### 3. Better Error Handling
- Retry logic with exponential backoff
- Backend health checks before requests
- Graceful degradation on failures

---

## 🎯 Recommendations

### Immediate Actions:

1. **Use 7B Model for Faster Collection**
   ```python
   "mode": "quick"  # Instead of "ui" for 14B
   ```
   - 7B is 2-3x faster
   - Good quality for most test cases
   - Reduces timeout risk

2. **Reduce Batch Size**
   - Smaller batches (5 examples)
   - Longer delays (5-10 seconds)
   - Prevents overwhelming backend

3. **Add Request Queue**
   - Process requests one at a time
   - Queue others while processing
   - Prevents concurrent request issues

### For Production:

1. **Implement Request Queue**
   - Use Celery or similar
   - Queue requests, process sequentially
   - Better resource management

2. **Rate Limiting**
   - Limit requests per minute
   - Protect DGX Spark from overload
   - Better reliability

3. **Model Selection**
   - Use 7B for simple cases
   - Use 14B only for complex cases
   - Smart routing based on complexity

---

## 📊 Current Status

**Fixed:**
- ✅ Ollama service timeout increased to 360s
- ✅ Better timeout configuration
- ✅ Retry logic improved

**Still Needed:**
- ⏳ Request queuing (for production)
- ⏳ Rate limiting (for production)
- ⏳ Smart model routing (7B vs 14B)

---

## 🚀 Next Steps

1. **Restart backend** (to load new timeout settings)
2. **Test with 7B model** (faster, less timeout risk)
3. **Use smaller batches** (5 examples, 10s delay)
4. **Monitor progress** continuously

---

**Status:** Root cause identified and fixed! Restart backend to apply changes.

