# 🔍 Flowstral Extension Debugging Guide

## Common Issues

### 1. Extension Popup Disappears

**Cause:** Popup closes automatically after clicking buttons (browser behavior)

**Solution:** 
- Popup closing is normal - recording continues in background
- Click extension icon again to see status
- Check browser console (F12) for logs

### 2. Events Not Being Captured

**Check:**
1. Open browser console (F12) on the page you're testing
2. Look for messages starting with "Flowstral Content:"
3. Should see: "Flowstral Content: Starting recording"
4. Should see: "Flowstral Content: Capturing event" when you click

**If no messages:**
- Content script might not be injected
- Check background script console: `chrome://extensions/` → Flowstral → "service worker" → Console
- Look for errors

### 3. Backend Connection Errors

**Check:**
1. Make sure backend is running on `localhost:8000`
2. Test API: Open `http://localhost:8000/docs` in browser
3. Check CORS is configured correctly

### 4. Content Script Not Loading

**Symptoms:**
- No console messages from content script
- Events not captured

**Fix:**
1. Go to `chrome://extensions/`
2. Find Flowstral extension
3. Click "Reload" button
4. Refresh the page you're testing

## Debug Steps

### Step 1: Check Background Script

1. Go to `chrome://extensions/`
2. Find "Flowstral Recorder"
3. Click "service worker" link (opens console)
4. Look for errors or logs

### Step 2: Check Content Script

1. Navigate to page you want to test (e.g., saucedemo.com)
2. Open browser console (F12)
3. Look for "Flowstral Content:" messages
4. Should see initialization messages

### Step 3: Check Popup

1. Click extension icon
2. Open browser console (F12) while popup is open
3. Look for "Flowstral" messages
4. Check for errors when clicking Start

### Step 4: Test API Directly

```javascript
// In browser console on any page:
fetch('http://localhost:8000/api/flowstral/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_id: 'test',
    user_id: 'test',
    initial_url: window.location.href
  })
}).then(r => r.json()).then(console.log);
```

## Expected Console Output

### When Starting:
```
Flowstral Background: Received message FLOWSTRAL_START
Flowstral Background: Starting session
Flowstral Background: Session started <session_id>
Flowstral Background: Content script notified
Flowstral Content: Received message FLOWSTRAL_START_RECORDING
Flowstral Content: Starting recording <session_id>
Flowstral Content: Recording initialized and active!
```

### When Clicking:
```
Flowstral Content: Capturing event click
Flowstral Content: Event sent successfully click
```

## Quick Fixes

1. **Reload extension**: `chrome://extensions/` → Reload
2. **Refresh page**: After reloading extension
3. **Check backend**: Make sure it's running
4. **Check permissions**: Extension needs all permissions in manifest



