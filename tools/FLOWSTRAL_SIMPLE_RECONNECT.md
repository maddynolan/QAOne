# 🔄 Flowstral Simple Reconnection Guide

## Problem

When you navigate to a different website (like saucedemo.com), the Flowstral panel is lost because it's part of the original page HTML.

## ✅ Simple Solution

After navigating to saucedemo.com, **paste this ONE line** into your browser console (F12):

```javascript
fetch('http://localhost:8081/flowstral_inject.js').then(r=>r.text()).then(eval).catch(()=>alert('Flowstral: Please visit http://localhost:8081/flowstral_recorder.html'))
```

That's it! The Flowstral panel will appear and reconnect to your session automatically.

## 📋 Step-by-Step

1. **Start Flowstral:**
   - Open: http://localhost:8081/flowstral_recorder.html
   - Enter Project ID: "test"
   - Click "Start Flowstral"

2. **Navigate:**
   - Enter URL: `saucedemo.com`
   - Click "Go"
   - Page navigates to saucedemo.com

3. **Reconnect (if panel doesn't appear automatically):**
   - Open browser console (F12)
   - Paste the code above
   - Press Enter
   - Flowstral panel appears!

4. **Continue Recording:**
   - Panel shows "Active" status
   - Click around on saucedemo.com
   - Events are captured!

## 🎯 Quick Copy-Paste Code

```javascript
fetch('http://localhost:8081/flowstral_inject.js').then(r=>r.text()).then(eval).catch(()=>alert('Flowstral: Please visit http://localhost:8081/flowstral_recorder.html'))
```

## 💡 Pro Tip

Bookmark this code or save it somewhere easy to access. You only need to paste it once after navigating to a new site.

---

**That's it! Much simpler than bookmarklet!** 🎉



