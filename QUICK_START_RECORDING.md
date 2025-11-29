# Quick Start: Test Recording Flow

## 🚀 Fastest Way to Test

### Step 1: Start Backend
```bash
cd backend
uvicorn app.main:app --reload
```

### Step 2: Open Recorder
Open `tools/browser_recorder.html` in your browser (double-click the file)

### Step 3: Record a Flow
1. Click **"Start Recording"** in the recorder panel
2. Navigate to any website (try https://example.com)
3. Click buttons, fill forms, navigate pages
4. Click **"Stop Recording"**

### Step 4: Generate Playwright Script
1. In the recorder panel, set API endpoint: `http://localhost:8000/api/app-first/record-and-generate`
2. Click **"Upload & Generate"**
3. A new window opens with your generated Playwright script! 🎉

## 📝 Example: Record Google Search

1. Start recording
2. Go to https://www.google.com
3. Type "playwright testing" in search box
4. Click search button
5. Stop recording
6. Upload & Generate

You'll get a Playwright script like:
```javascript
import { test, expect } from '@playwright/test';

test('Recorded Test', async ({ page }) => {
  await page.goto('https://www.google.com');
  await page.fill('input[name="q"]', 'playwright testing');
  await page.click('button[type="submit"]');
});
```

## 🧪 Run the Generated Script

1. Save the script as `test.spec.js`
2. Install Playwright: `npm install -D @playwright/test && npx playwright install`
3. Run: `npx playwright test test.spec.js`

## 🔧 Alternative: Test Script

Run automated tests:
```bash
python tools/test_recording_flow.py
```

## 📚 More Info

See `tools/README_RECORDING.md` for detailed instructions.



