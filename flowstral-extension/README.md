# Flowstral Recorder

Flowstral Recorder is a browser extension that captures user actions and generates reliable Playwright test scripts. Designed to be better than Tosca and similar enterprise tools, with support for 20+ enterprise applications.

## Key Features

### 🎯 Smart Multi-Strategy Selectors
Unlike Tosca's single-selector approach, this recorder generates multiple selector strategies for each element and ranks them by reliability:

1. **Data attributes** (`data-testid`, `data-test`, `data-cy`) - Most reliable
2. **ARIA attributes** (`aria-label`, role + name) - Great for accessible apps
3. **Form attributes** (placeholder, name, label associations)
4. **ID selectors** (with dynamic ID detection to avoid flaky selectors)
5. **Text content** (button text, link text, alt text)
6. **CSS selectors** (stable classes only, filters out CSS-in-JS)
7. **XPath** (as last resort fallback)

### 🔄 Self-Healing Selectors
Generated scripts include fallback selectors, so if the primary selector fails, alternatives are used automatically.

### ⏱️ Intelligent Wait Strategies
- Auto-detects navigation triggers
- Adds `waitForLoadState` after page loads
- Adds element waits after content-changing actions
- Handles SPAs with URL change detection

### 🧹 Action Deduplication
- Filters out redundant rapid clicks
- Combines sequential keypresses into fill actions
- Removes implicit focus events

### 📝 Clean, Maintainable Output
- Human-readable code with descriptive comments
- Uses Playwright's recommended locator methods
- Follows Playwright best practices

### 🌐 HAR Capture for Load Testing & API Testing
During recording you can enable **Protocol Capture** to capture HTTP/WebSocket traffic as **HAR (HTTP Archive)**:

- **Load testing:** Export HAR and import into k6, Gatling, JMeter, or NeoLoad to replay traffic at scale.
- **API testing:** Use the same HAR in Postman, Insomnia, or your API test suite; request/response headers and timing are preserved.
- **Format:** HAR 1.2 (standard). Captures XHR, Fetch, document, and WebSocket; optional correlation detection for session/auth tokens.
- **Where:** Record tab → toggle "Protocol Capture" before Start → after Stop, use **Export HAR** or **Load Test** to download `.har` or send to the backend.

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `flowstral-extension` folder

### Build for Production

```bash
# Install dependencies (optional, for building/testing)
npm install

# The extension can be loaded directly without building
```

## Usage

### Recording Actions

1. Click the extension icon in your browser toolbar
2. Click "Start Recording"
3. Perform your test actions on any website
4. Click the extension icon again and click "Stop"
5. Click "Generate Script" to create your Playwright test
6. Click "Download" to save the test file

### Generated Script Example

```typescript
import { test, expect } from '@playwright/test';

/**
 * Login Test
 * Recorded on: 2024-01-15T10:30:00.000Z
 * Starting URL: https://example.com/login
 */
test('Login Test', async ({ page }) => {
  // Navigate to starting URL
  await page.goto('https://example.com/login');
  await page.waitForLoadState('networkidle');

  // Fill "Email" input
  await page.getByLabel('Email').fill('user@example.com');

  // Fill "Password" input  
  await page.getByLabel('Password').fill('secret123');

  // Click "Sign In" button
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle');

  // Test complete
});
```

## Why Better Than Tosca?

| Feature | Tosca | Playwright Recorder Pro |
|---------|-------|------------------------|
| Selector Strategy | Single selector | Multiple ranked selectors |
| Dynamic ID Handling | Manual configuration | Automatic detection |
| CSS-in-JS Support | Limited | Full support |
| Wait Strategies | Generic waits | Context-aware intelligent waits |
| Output Format | Proprietary | Standard Playwright/TypeScript |
| Cost | Enterprise pricing | Free & Open Source |
| Customization | Limited | Fully customizable |

## Configuration Options

In the extension popup, you can configure:

- **Output Language** - Toggle between TypeScript and Python
- **Include comments** - Add descriptive comments to generated code
- **Generate assertions** - Add `expect` statements for validations
- **Add wait strategies** - Include intelligent waits

## Output Examples

### TypeScript Output
```typescript
import { test, expect } from '@playwright/test';

test('Login Test', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Sign In' }).click();
});
```

### Python Output
```python
from playwright.sync_api import Page, expect

def test_login_test(page: Page):
    page.goto("https://example.com/login")
    page.get_by_label("Email").fill("user@example.com")
    page.get_by_label("Password").fill("secret123")
    page.get_by_role("button", name="Sign In").click()
```

## Supported Actions

- ✅ Click (single, double, right-click)
- ✅ Text input (fill, type)
- ✅ Form elements (select, checkbox, radio)
- ✅ Keyboard shortcuts
- ✅ Navigation (goto, back, forward)
- ✅ File uploads
- ✅ Hover actions
- ✅ SPA navigation detection

## Deep Research Approaches

For extending this tool or building similar solutions, consider these research areas:

### 1. Machine Learning for Selector Stability
- Train models on DOM structures to predict selector reliability
- Use historical test failure data to improve selector ranking
- Implement collaborative filtering from community test results

### 2. Visual Testing Integration
- Combine action recording with visual regression testing
- Use computer vision to identify elements by appearance
- Implement visual locators as fallback strategy

### 3. Behavior Pattern Analysis
- Analyze user interaction patterns to predict intent
- Group related actions into logical test steps
- Auto-generate Page Object Models from recordings

### 4. Natural Language Generation
- Convert recorded actions to BDD-style scenarios
- Generate human-readable test descriptions
- Support multiple output formats (Gherkin, plain English)

### 5. Cross-Browser Compatibility
- Extend to Firefox, Safari, Edge
- Test selector compatibility across browsers
- Implement browser-specific selector strategies

### 6. Advanced Test Enhancement
- Use LLMs to suggest additional test assertions
- Auto-generate edge case scenarios
- Implement smart test data generation

### 7. Integration Testing
- Record API calls alongside UI actions
- Generate full integration tests
- Mock network responses based on recordings

## Architecture

```
playwright-recorder-extension/
├── manifest.json           # Extension configuration
├── src/
│   ├── background/
│   │   └── background.js   # Service worker, manages state
│   ├── content/
│   │   ├── content.js      # Captures DOM events
│   │   └── content.css     # Recording indicator styles
│   ├── popup/
│   │   ├── popup.html      # Extension popup UI
│   │   └── popup.js        # Popup controller
│   └── lib/
│       ├── smart-selector.js   # Selector generation
│       └── playwright-generator.js # Script generation
└── icons/                  # Extension icons
```

## Contributing

Contributions are welcome! Areas for improvement:

1. Additional selector strategies
2. Support for more frameworks (React, Vue, Angular specifics)
3. Shadow DOM support
4. iframe handling improvements
5. Test runner integration

## License

MIT License - Use freely in personal and commercial projects.

## Related Projects

- [Playwright](https://playwright.dev/) - The testing framework
- [Playwright Codegen](https://playwright.dev/docs/codegen) - Official Playwright recorder
- [Testing Library](https://testing-library.com/) - Testing utilities

---

Built with ❤️ for the testing community
