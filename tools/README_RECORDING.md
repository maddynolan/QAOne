# Testing App-First Flow Recording

This guide shows you how to test the recording flow and Playwright script generation.

## Quick Start

### Option 1: Browser Recorder (Recommended)

1. **Open the recorder**:
   ```bash
   # Open tools/browser_recorder.html in your browser
   # Or serve it with a simple HTTP server:
   cd tools
   python -m http.server 8080
   # Then open http://localhost:8080/browser_recorder.html
   ```

2. **Start the backend** (if not running):
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

3. **Record a flow**:
   - Click "Start Recording" in the recorder panel
   - Navigate to any website (e.g., https://example.com)
   - Interact with the page (click buttons, fill forms, etc.)
   - Click "Stop Recording"

4. **Upload and generate**:
   - Configure API endpoint: `http://localhost:8000/api/app-first/record-and-generate`
   - Optionally add API key (if required)
   - Click "Upload & Generate"
   - A new window will open with the generated Playwright script

5. **View results**:
   - Check the console for Flow ID and Recording ID
   - The Playwright script will be displayed in a new window
   - Test cases and requirements will be shown

### Option 2: Test Script

Run the automated test script:

```bash
cd backend
python ../tools/test_recording_flow.py
```

This will:
- Test DOM recorder
- Test Automation Agent
- Test Test Design Agent
- Test complete flow
- Show generated Playwright scripts

### Option 3: Direct API Call

Use curl or Postman to test the API:

```bash
curl -X POST http://localhost:8000/api/app-first/record-and-generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "url": "https://example.com",
    "title": "Test Flow",
    "snapshots": [
      {
        "timestamp": 0,
        "dom": "<html><body><button id=\"test\">Click Me</button></body></html>",
        "interactions": [
          {
            "type": "click",
            "selector": "#test",
            "timestamp": 1000
          }
        ]
      }
    ],
    "metadata": {
      "browser": "Chrome",
      "viewport": {"width": 1920, "height": 1080}
    }
  }'
```

## Running Generated Playwright Scripts

1. **Save the script**:
   ```javascript
   // Save as test.spec.js
   import { test, expect } from '@playwright/test';

   test('Recorded Test', async ({ page }) => {
     await page.goto('https://example.com');
     await page.click('#test');
     // ... more steps
   });
   ```

2. **Install Playwright** (if not installed):
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

3. **Run the test**:
   ```bash
   npx playwright test test.spec.js
   ```

## Testing on Different Websites

### Example 1: Google Search

1. Start recording
2. Go to https://www.google.com
3. Type a search query
4. Click search button
5. Stop recording
6. Upload and generate

### Example 2: E-commerce Site

1. Start recording
2. Go to an e-commerce site
3. Search for a product
4. Add to cart
5. Go to checkout
6. Stop recording
7. Upload and generate

### Example 3: Login Flow

1. Start recording
2. Go to a login page
3. Enter username and password
4. Click login
5. Stop recording
6. Upload and generate

## Troubleshooting

### Recorder not capturing interactions

- Make sure you clicked "Start Recording" before interacting
- Check browser console for errors
- Some sites may block event listeners (try a different site)

### API errors

- Check backend is running: `curl http://localhost:8000/docs`
- Check API endpoint URL is correct
- Verify API key if authentication is required
- Check backend logs for errors

### Playwright script not generating

- Check backend logs
- Verify recording data format
- Make sure DOM snapshots contain valid HTML
- Check that interactions have valid selectors

### Generated script doesn't work

- Selectors may need adjustment (some sites use dynamic IDs)
- Try using more stable selectors (data-testid, role, label)
- Check if site requires authentication
- Verify the site hasn't changed since recording

## Advanced Usage

### Custom Selectors

The recorder tries to generate stable selectors, but you can improve them:

1. Use `data-testid` attributes in your app
2. Use semantic HTML (labels, roles)
3. Avoid nth-child selectors when possible

### Recording Complex Flows

- Record in smaller chunks (one flow per recording)
- Wait for page loads between interactions
- Capture form submissions explicitly

### Integration with CI/CD

1. Record flows during development
2. Export recordings as JSON
3. Commit to repository
4. Generate tests in CI/CD pipeline
5. Run tests automatically

## Next Steps

- Execute generated tests: See `tools/test_execution.md`
- View findings: Check `/api/app-first/findings/{flow_id}`
- File defects: Configure Jira integration
- Performance testing: Enable `enable_performance: true`
- Accessibility testing: Enable `enable_accessibility: true`



