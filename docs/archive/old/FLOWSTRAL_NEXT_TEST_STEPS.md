# Flowstral - Next Test Steps

## ✅ Service Worker Status: WORKING

Your service worker is now loading correctly! You can see:
- ✅ Service worker loaded
- ✅ Extension icon click works
- ✅ Side panel opens
- ✅ Messages are being received and sent

## Next Steps to Test Event Capture

### Step 1: Start Recording

1. **Open the side panel** (click extension icon)
2. **Click "Start Flowstral"** button
3. **Watch the service worker console** - you should see:
   ```
   Flowstral Background: Handling FLOWSTRAL_START
   Flowstral Background: Starting session
   Flowstral Background: Session started successfully
   ```

### Step 2: Check Content Script

1. **Open browser console** (F12) on the page you're testing
2. **You should see:**
   ```
   Flowstral Content: Script loaded on https://...
   Flowstral Content: Checking for existing session
   Flowstral Content: Session activated via storage change
   Flowstral Content: Starting recording...
   ```

### Step 3: Interact with Page

1. **Click a button** on the page
2. **Check browser console** - should see:
   ```
   Flowstral Content: Click detected ...
   Flowstral Content: Capturing event click ...
   Flowstral Content: Event sent successfully click
   ```

### Step 4: Check Service Worker Console

1. **Go back to service worker console**
2. **You should see:**
   ```
   Flowstral Background: Event added to batch (1/5): click - ...
   Flowstral Background: Flushing batch of X events
   Flowstral Background: Batch sent successfully
   ```

### Step 5: Check Network Tab

1. **Open DevTools → Network tab**
2. **Filter by: `capture-events-batch`**
3. **You should see POST requests** when you click

### Step 6: Check Backend Logs

1. **Check backend logs** - should see:
   ```
   [BATCH] Received batch request with X events
   [BATCH] Event 1: event_type=click
   [CAPTURE] Processing event: event_type=click
   ```

## What to Share

If events still aren't being captured, share:

1. **Browser console output** (all "Flowstral Content:" messages)
2. **Service worker console output** (all "Flowstral Background:" messages)
3. **Network tab** (any requests to `/api/flowstral/capture-events-batch`)
4. **Backend logs** (last 50 lines)

## Expected Flow

```
User clicks "Start Flowstral"
  ↓
Service Worker: FLOWSTRAL_START message
  ↓
Backend: Session created
  ↓
Service Worker: Stores session in chrome.storage
  ↓
Content Script: Detects storage change
  ↓
Content Script: Starts recording (isRecording = true)
  ↓
User clicks button
  ↓
Content Script: Captures click event
  ↓
Content Script: Sends to Service Worker
  ↓
Service Worker: Batches events
  ↓
Service Worker: Sends batch to Backend
  ↓
Backend: Processes events
  ↓
Action Graph: New node added
```

## Current Status

- ✅ Service Worker: Working
- ❓ Content Script: Need to verify
- ❓ Event Capture: Need to test
- ❓ Backend Processing: Need to verify

Try starting a recording session and clicking something, then share what you see in the consoles!




