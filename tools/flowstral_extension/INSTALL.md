# 🚀 Flowstral Extension - Quick Install Guide

## Installation Steps

### 1. Open Extensions Page

**Chrome:**
- Go to `chrome://extensions/`

**Edge:**
- Go to `edge://extensions/`

### 2. Enable Developer Mode

- Toggle **Developer mode** switch in the top-right corner

### 3. Load Extension

- Click **Load unpacked** button
- Navigate to: `C:\QAAI\tools\flowstral_extension`
- Click **Select Folder**

### 4. Verify Installation

- You should see "Flowstral Recorder" extension in the list
- Look for the Flowstral icon in your browser toolbar
- Click it to open the popup

## ✅ First Use

1. **Navigate to any website** (e.g., https://www.saucedemo.com)
2. **Click Flowstral extension icon** in toolbar
3. **Enter Project ID**: "test"
4. **Click Start**
5. **Interact with the page** - events are captured automatically!

## 🎯 What This Solves

- ✅ **No CORS issues** - Extension has permissions
- ✅ **No Same Origin Policy** - Content scripts run on any page
- ✅ **No console code needed** - Everything works automatically
- ✅ **Works on ANY website** - No restrictions!

## 📝 Notes

- Make sure backend is running on `localhost:8000`
- Extension automatically captures clicks, inputs, navigation
- WCAG scans and performance metrics run automatically
- All data is sent to your Flowstral backend API

## 🐛 Troubleshooting

**Extension not showing:**
- Make sure Developer mode is enabled
- Check for errors in Extensions page
- Reload the extension if needed

**Events not captured:**
- Check backend is running
- Open browser console (F12) to see logs
- Verify extension permissions in manifest.json

---

**That's it! Much better than the web page approach!** 🎉



