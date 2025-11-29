# 🔧 Flowstral Extension Troubleshooting

## Quick Checks

### 1. Is Extension Loaded?

1. Go to `chrome://extensions/`
2. Find "Flowstral Recorder"
3. Make sure it's **enabled** (toggle is ON)
4. If not, enable it and reload

### 2. Is Backend Running?

Open in browser: `http://localhost:8000/docs`

Should see FastAPI docs. If not, start backend:
```powershell
cd C:\QAAI\backend
python -m uvicorn app.main:app --reload
```

### 3. Check Background Script

1. Go to `chrome://extensions/`
2. Find "Flowstral Recorder"
3. Click **"service worker"** link (opens console)
4. Should see: `Flowstral Background: Service worker loaded`
5. If errors, they'll show here

### 4. Check Content Script

1. Navigate to saucedemo.com
2. Open browser console (F12)
3. Should see: `Flowstral Content: Script loaded on https://www.saucedemo.com`
4. If you don't see this, content script isn't loading

### 5. Test Start Flow

1. Click extension icon
2. Enter Project ID: "test"
3. Click Start
4. Check console (F12) on saucedemo.com
5. Should see:
   - `Flowstral Content: Starting recording`
   - `Flowstral Content: Recording initialized and active!`
   - Green indicator appears in top-right corner

### 6. Test Click Capture

1. After starting, click anywhere on page
2. Check console (F12)
3. Should see: `Flowstral Content: Capturing event click`
4. Should see: `Flowstral Content: Event sent successfully click`

## Common Issues

### Issue: No console messages at all

**Possible causes:**
- Content script not injected
- Extension not enabled
- Page blocked content scripts

**Fix:**
1. Reload extension: `chrome://extensions/` → Reload
2. Refresh the page
3. Check manifest.json has correct matches

### Issue: "Flowstral Content: Script loaded" but no recording

**Possible causes:**
- Background script not receiving messages
- Session not starting
- API connection failed

**Fix:**
1. Check background script console (service worker)
2. Check for API errors
3. Verify backend is running

### Issue: Events not being captured

**Possible causes:**
- Recording not started
- Event listeners not attached
- Session ID missing

**Fix:**
1. Check console for "Recording initialized and active!"
2. Verify green indicator is visible
3. Check background script for session ID

### Issue: Extension popup closes immediately

**This is NORMAL!** Popup closes after clicking buttons. Recording continues in background.

**To check status:**
- Click extension icon again
- Look for green indicator on page
- Check console messages

## Step-by-Step Debug

### Step 1: Verify Extension Loads

```
chrome://extensions/ → Flowstral Recorder → Should be enabled
```

### Step 2: Check Background Script

```
chrome://extensions/ → service worker → Console
Should see: "Flowstral Background: Service worker loaded"
```

### Step 3: Check Content Script Injection

```
Navigate to saucedemo.com → F12 → Console
Should see: "Flowstral Content: Script loaded on https://www.saucedemo.com"
```

### Step 4: Start Recording

```
Click extension → Enter "test" → Click Start
Check console → Should see: "Flowstral Content: Starting recording"
Check page → Should see green indicator
```

### Step 5: Test Click

```
Click anywhere on page
Check console → Should see: "Flowstral Content: Capturing event click"
```

## Still Not Working?

1. **Reload extension** completely
2. **Refresh the page** you're testing
3. **Check all consoles** (popup, background, content)
4. **Verify backend** is running and accessible
5. **Check for errors** in all consoles

## Expected Flow

```
1. Extension loads → Background script active
2. Navigate to page → Content script injected
3. Click Start → Background creates session
4. Background → Content: "Start recording"
5. Content script → Shows indicator, attaches listeners
6. User clicks → Content captures event
7. Content → Background → API: Event sent
8. Backend processes → Artifacts generated
```

---

**If you see the green indicator, recording IS working!** ✅



