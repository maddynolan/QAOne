# 🔍 Flowstral Debugging Guide

## ⚠️ Important: Browser Security Limitation

**Flowstral can ONLY capture events on the SAME page where it's running.**

JavaScript cannot capture events from:
- Other browser tabs
- Other websites
- Different domains

This is a browser security feature (Same-Origin Policy).

## ✅ How to Use Flowstral

### Option 1: Use Flowstral ON the Page You Want to Test

**For testing your own website:**
1. Open your website (e.g., `https://example.com`)
2. Open browser console (F12)
3. Paste the Flowstral recorder code
4. Start Flowstral
5. Interact with the page

**OR use the standalone recorder:**
1. Open `tools/flowstral_recorder.html` in your browser
2. Navigate to the website you want to test
3. The recorder panel stays on top
4. Start Flowstral
5. Interact with the page

### Option 2: Inject Flowstral into Any Page

You can inject Flowstral into any page using a bookmarklet or browser console.

## 🐛 Debugging Steps

### 1. Check Browser Console

Open browser console (F12) and look for:
- `"Flowstral: Event listeners attached"` - confirms listeners are set up
- `"Flowstral: Click event captured"` - confirms clicks are detected
- `"Flowstral: Event captured successfully"` - confirms API call worked
- Any error messages

### 2. Check Backend Logs

Look for:
- `"Flowstral request without API key"` - confirms requests are coming
- `"Flowstral session started"` - confirms session created
- `"DOM snapshot failed"` - warnings are OK, errors need fixing
- Any 500 errors

### 3. Test API Directly

```powershell
# Test start endpoint
$body = @{
    project_id = "test"
    user_id = "test"
    initial_url = "https://example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/flowstral/start" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### 4. Check Network Tab

In browser DevTools → Network tab:
- Look for requests to `/api/flowstral/capture-event`
- Check if they're successful (200) or failing (400/500)
- Check request/response payloads

## 🔧 Common Issues

### Issue: "No events captured"

**Causes:**
1. Flowstral is on different page than where you're clicking
2. Event listeners not attached
3. Session not active

**Fix:**
- Make sure you're clicking on the SAME page where Flowstral is running
- Check console for "Event listeners attached"
- Verify session is active (status badge shows "Active")

### Issue: "Events captured but not showing in UI"

**Causes:**
1. API calls failing
2. Response not being processed
3. UI update failing

**Fix:**
- Check Network tab for failed requests
- Check console for errors
- Check backend logs

### Issue: "Can't stop session"

**Causes:**
1. Session not found on backend
2. API call failing
3. Frontend state issue

**Fix:**
- Check backend logs for session ID
- Verify session exists
- Check Network tab for stop request

## 📊 Expected Behavior

### When Flowstral Starts:
1. Console: `"Flowstral: Event listeners attached"`
2. Status badge: Changes to "Active"
3. Backend log: `"Flowstral session started: {session_id}"`

### When You Click:
1. Console: `"Flowstral: Click event captured"`
2. Network: POST to `/api/flowstral/capture-event`
3. Console: `"Flowstral: Event captured successfully"`
4. UI: Playwright code appears in tab

### When You Stop:
1. Network: POST to `/api/flowstral/stop`
2. Console: `"Flowstral: Session stopped successfully"`
3. New window: Artifacts displayed

## 🚀 Quick Test

1. Open http://localhost:8080/flowstral
2. Open browser console (F12)
3. Enter Project ID
4. Click "Start Flowstral"
5. **Click anywhere on the Flowstral page itself** (not another tab)
6. Check console for messages
7. Check Playwright tab for code
8. Click "Stop"

If this works, Flowstral is working correctly. The limitation is that it only works on the same page.



