# Flowstral: Popup vs Side Panel - What's the Difference?

## What You're Currently Seeing: **POPUP** ✅

Based on your screenshot, you're seeing the **Flowstral Popup** - the small window that appears when you click the extension icon.

### Popup Features (What You See):
- ✅ Small window that overlays the page
- ✅ Shows "Flowstral" with star icon
- ✅ Status badge (Stopped/Active)
- ✅ Node/Edge counts
- ✅ Start/Stop buttons
- ✅ Project ID input
- ✅ Status messages at bottom

**This is working correctly!** The popup is functional.

---

## What is the Side Panel? **DIFFERENT UI** 🆕

The **Side Panel** is a **larger, persistent panel** that opens on the **right side** of your browser window (not a small popup).

### Side Panel Features:
- ✅ **Larger space** - More room for information
- ✅ **Stays open** - Doesn't close when you navigate
- ✅ **Better for long sessions** - More detailed logs and status
- ✅ **Opens automatically** - When you click the extension icon

### Visual Comparison:

```
POPUP (What you see now):
┌─────────────────┐
│ ⭐ Flowstral    │  ← Small window
│ 0 Nodes         │     overlays page
│ [Start] [Stop]  │
│ Project ID: ___ │
└─────────────────┘

SIDE PANEL (Alternative):
┌─────────────────────────────────────┐
│ Website │ ⭐ Flowstral Side Panel   │
│         │ ─────────────────────     │
│         │ Project ID: [input]       │
│         │ [Start Flowstral]         │
│         │ Status: Recording...      │
│         │ Steps: 5                  │
│         │ Duration: 00:45          │
│         │ [Activity Log]           │
│         │ [Scrollable log area]     │
└─────────────────────────────────────┘
```

---

## How to Access Side Panel

The side panel should open **automatically** when you click the extension icon, but if you're seeing the popup instead:

### Option 1: Check Manifest Configuration
The extension is configured to open the **side panel** when you click the icon. If you're seeing the popup, it might be:
- Browser caching the old popup
- Extension needs to be reloaded

### Option 2: Reload Extension
1. Go to `chrome://extensions`
2. Find "Flowstral Recorder"
3. Click the **reload icon** (circular arrow)
4. Click the extension icon again
5. Side panel should open on the right side

### Option 3: Manual Side Panel Access
1. Right-click the Flowstral extension icon
2. Look for "Open side panel" option
3. Or use keyboard shortcut (if configured)

---

## Which One Should You Use?

### Use **POPUP** (Current) if:
- ✅ Quick start/stop
- ✅ Simple recording
- ✅ You prefer compact UI

### Use **SIDE PANEL** (Recommended) if:
- ✅ Long recording sessions
- ✅ Want to see detailed logs
- ✅ Need more information visible
- ✅ Better UX for complex flows

---

## Current Status

**Your popup is working!** You can:
1. ✅ Enter Project ID
2. ✅ Click "Start" to begin recording
3. ✅ See node/edge counts
4. ✅ Click "Stop" to generate artifacts

**Both UIs work the same way** - they both:
- Start/stop Flowstral sessions
- Show status and counts
- Generate artifacts

The **side panel** just gives you **more space** and **better visibility** for longer sessions.

---

## Quick Test

1. **Current (Popup)**: Click extension icon → Small window appears ✅ (This is what you see)
2. **Side Panel**: Click extension icon → Large panel opens on right side (Should happen automatically)

If side panel doesn't open, reload the extension and try again!

---

**TL;DR**: You're seeing the **popup** (small window) - it works! The **side panel** is a larger alternative that opens on the side. Both work the same, side panel just has more space. 🎯



