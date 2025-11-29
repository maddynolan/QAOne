# Flowstral Browser Extension

## ✅ Solution to Cross-Origin Issues

This browser extension solves all the cross-origin and Same Origin Policy issues by:

1. **Content Scripts** - Run in the context of any page, so they can access DOM directly
2. **Extension Permissions** - Bypass CORS for API calls to localhost:8000
3. **Background Service Worker** - Coordinates between popup UI and content scripts
4. **No Manual Console Code** - Everything works automatically!

## 📦 Installation

### Step 1: Load Extension in Chrome/Edge

1. Open Chrome/Edge
2. Go to `chrome://extensions/` (or `edge://extensions/`)
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `tools/flowstral_extension` folder

### Step 2: Verify Installation

- You should see the Flowstral extension icon in your toolbar
- Click it to open the popup UI

## 🚀 Usage

### Start Recording

1. Navigate to any website (e.g., https://www.saucedemo.com)
2. Click the Flowstral extension icon
3. Enter Project ID: "test"
4. Click **Start**
5. Flowstral is now recording!

### Record Actions

- Click around the page
- Fill in forms
- Navigate between pages
- All events are captured automatically!

### Stop Recording

1. Click the Flowstral extension icon again
2. Click **Stop**
3. Artifacts are generated and displayed

## 🎯 Features

- ✅ Works on ANY website (no CORS issues)
- ✅ Automatic event capture (clicks, inputs, navigation)
- ✅ WCAG accessibility scanning
- ✅ Performance metrics collection
- ✅ Network request tracking
- ✅ No manual console code needed!

## 📁 File Structure

```
flowstral_extension/
├── manifest.json          # Extension manifest (permissions, scripts)
├── background.js          # Service worker (coordinates everything)
├── content.js            # Injected into pages (captures events)
├── popup.js              # Popup UI logic
├── flowstral_recorder.html # Popup UI
└── README.md             # This file
```

## 🔧 How It Works

1. **Popup UI** (`flowstral_recorder.html` + `popup.js`)
   - User interface for starting/stopping
   - Shows status and stats

2. **Background Script** (`background.js`)
   - Service worker that coordinates everything
   - Makes API calls to localhost:8000
   - Manages session state

3. **Content Script** (`content.js`)
   - Injected into every page
   - Captures clicks, inputs, navigation
   - Runs WCAG scans and performance metrics
   - Sends events to background script

4. **Backend API** (localhost:8000)
   - Receives events from extension
   - Generates Playwright code
   - Creates test cases and artifacts

## 🐛 Troubleshooting

### Extension not loading
- Make sure Developer mode is enabled
- Check for errors in `chrome://extensions/`
- Verify all files are in the extension folder

### Events not captured
- Make sure backend is running on localhost:8000
- Check browser console for errors
- Verify extension has proper permissions

### CORS errors
- Extension should bypass CORS automatically
- Check `manifest.json` has correct `host_permissions`

## 🎉 Benefits Over Web Page Approach

- ✅ No Same Origin Policy issues
- ✅ No CORS problems
- ✅ Works on any website automatically
- ✅ Better UX (no console code needed)
- ✅ More reliable and scalable

---

**This is the proper architectural solution!** 🚀



