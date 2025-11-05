# 🔧 Timeout Issues - Root Cause & Fixes

## ⚠️ Problems Identified

### 1. Request Timeouts (180s)
**Issue:** Requests timing out after 180 seconds  
**Cause:** DGX Spark 14B model takes 114-117 seconds (2 minutes) per request  
**Impact:** Some requests fail when they take longer than 180s

### 2. Backend Unreachable
**Issue:** Monitor shows "Cannot reach backend"  
**Cause:** Backend might be:
- Overwhelmed with too many concurrent requests
- Processing slow requests and not responding to health checks
- Crashed or hung

### 3. Rating Timeout (10s)
**Issue:** Rating requests timeout after 10 seconds  
**Cause:** Backend busy processing generation requests  
**Impact:** Generations saved but ratings not stored

---

## ✅ Fixes Applied

### 1. Increased Request Timeout
- **Before:** 180 seconds (3 minutes)
- **After:** 300 seconds (5 minutes)
- **Reason:** 14B model can take 2-3 minutes, need buffer

### 2. Increased Rating Timeout
- **Before:** 10 seconds
- **After:** 30 seconds
- **Reason:** Backend might be busy, needs more time

### 3. Added Retry Logic
- **Max Retries:** 3 attempts
- **Retry Delay:** 5 seconds between retries
- **Backend Health Check:** Verifies backend is up before requests

### 4. Better Error Handling
- Checks backend health before each request
- Waits for backend if unreachable
- Continues collection even if some requests fail
- Tracks failures separately from successes

### 5. Increased Delay Between Requests
- **Before:** 2.0-2.5 seconds
- **After:** 3.0 seconds (recommended)
- **Reason:** Give backend time to process each request

---

## 🎯 Recommendations

### For Continuous Collection:

1. **Use Robust Collector**
   ```bash
   python scripts/robust_data_collection.py --count 10 --delay 3.0
   ```

2. **Monitor Backend**
   - Check backend logs for errors
   - Monitor CPU/memory usage
   - Ensure backend isn't overloaded

3. **Batch Size**
   - Smaller batches (5-10 examples)
   - Longer delays (3-4 seconds)
   - Prevents overwhelming backend

4. **Check DGX Spark**
   - Monitor GPU usage
   - Check if models are loaded
   - Verify network connection

---

## 📊 Current Status

**Fixed:**
- ✅ Increased request timeout to 300s
- ✅ Increased rating timeout to 30s
- ✅ Added retry logic
- ✅ Added backend health checks
- ✅ Better error handling

**Monitoring:**
- Backend health checks before each request
- Automatic retry on failures
- Progress tracking continues even with failures

---

**Status:** Fixed! Use `robust_data_collection.py` for reliable collection.

