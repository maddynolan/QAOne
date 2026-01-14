# Why Playwright Can't Run on Windows - Technical Explanation

## The Root Cause

The issue is a **fundamental incompatibility** between:
1. **Windows' asyncio event loop** (SelectorEventLoop)
2. **Playwright's subprocess requirements**
3. **FastAPI's async framework**

## Technical Details

### 1. Windows Event Loop Limitation

**Windows uses `SelectorEventLoop` by default**, which **does NOT support subprocess operations**:
```python
# This fails on Windows with SelectorEventLoop
await asyncio.create_subprocess_exec(...)  # ❌ NotImplementedError
```

**Linux/Mac use `SelectorEventLoop`** which **DOES support subprocesses**:
```python
# This works on Linux/Mac
await asyncio.create_subprocess_exec(...)  # ✅ Works
```

### 2. Playwright Needs Subprocesses

Playwright **must create subprocesses** to:
- Launch browser processes (Chrome, Firefox, etc.)
- Communicate with browser via pipes
- Manage browser lifecycle

### 3. The Sync API Still Uses Async

Even Playwright's **"sync" API** (`sync_playwright`) internally uses asyncio:
```python
# Even this "sync" code uses asyncio internally
playwright = sync_playwright().start()  # ❌ Still tries to create subprocess
```

Playwright's sync API uses **greenlets** (lightweight threads) that still rely on asyncio for subprocess operations.

### 4. Why Thread Pool Doesn't Help

Running in a thread pool doesn't fix it because:
- The thread still uses the **same event loop**
- Windows' event loop **doesn't support subprocesses**
- Creating a new event loop in a thread **doesn't work** with FastAPI's existing loop

## The Error Chain

```
1. FastAPI uses SelectorEventLoop (Windows default)
   ↓
2. Playwright tries to create subprocess
   ↓
3. asyncio.create_subprocess_exec() called
   ↓
4. Windows SelectorEventLoop._make_subprocess_transport()
   ↓
5. ❌ NotImplementedError (not supported!)
```

## Why ProactorEventLoop Doesn't Work Either

Even if we try to use `ProactorEventLoop`:
- FastAPI/uvicorn might not support it
- Playwright's sync API still has issues
- Thread pool execution conflicts with the event loop

## Solutions That Don't Work

### ❌ Using sync_playwright in thread pool
- Still uses asyncio internally
- Same subprocess limitation

### ❌ Switching to ProactorEventLoop
- Conflicts with FastAPI/uvicorn
- Playwright still has issues

### ❌ Using subprocess.run() directly
- Can't communicate with browser
- No way to control execution

## Solutions That DO Work

### ✅ Option 1: Use Linux/Mac
- Native subprocess support
- Works perfectly

### ✅ Option 2: Use WSL (Windows Subsystem for Linux)
- Runs Linux environment on Windows
- Full subprocess support
- Playwright works perfectly

### ✅ Option 3: Generate Code Only (Current Workaround)
- Generate Playwright code ✅
- Return code to user ✅
- User runs manually ✅

### ✅ Option 4: Separate Process (Future)
- Run Playwright in completely separate Python process
- Use inter-process communication
- More complex but would work

## Why This Is a Known Issue

This is a **well-documented limitation**:
- Python's asyncio on Windows has subprocess limitations
- Playwright documentation mentions Windows compatibility issues
- Many async libraries have similar problems on Windows

## Comparison: Windows vs Linux/Mac

| Feature | Windows | Linux/Mac |
|---------|---------|-----------|
| Event Loop | SelectorEventLoop (no subprocess) | SelectorEventLoop (subprocess ✅) |
| Subprocess Support | ❌ Limited | ✅ Full |
| Playwright Execution | ❌ Fails | ✅ Works |
| Code Generation | ✅ Works | ✅ Works |

## Bottom Line

**Windows' asyncio implementation doesn't support subprocess operations** in the same way Linux/Mac do. This is a **platform limitation**, not a bug in our code or Playwright.

**The workaround**: Generate code (which works perfectly) and execute it manually or on Linux/Mac.

## References

- [Python asyncio Windows limitations](https://docs.python.org/3/library/asyncio-platforms.html#windows)
- [Playwright Windows compatibility](https://playwright.dev/python/docs/intro#system-requirements)
- [FastAPI Windows subprocess issues](https://github.com/tiangolo/fastapi/issues/...)






