/**
 * Shared helper functions for PlaywrightRecorder and its extracted modules.
 *
 * Extracted to avoid circular dependencies when recorder-run-test.js
 * needs access to module-level functions from playwright-recorder.js.
 */

const { chromium } = require('playwright');

// ============================================================
// BROWSER LAUNCH HELPER - Tries Playwright browsers, then system Chrome/Edge
// Required because packaged app may not have Playwright browsers bundled
// ============================================================
async function launchBrowserWithFallback(launchOptions, userDataDir = null) {
  const channels = [null, 'chrome', 'msedge', 'chromium'];
  let lastError = null;

  for (const channel of channels) {
    try {
      const opts = { ...launchOptions };
      if (channel) {
        console.log(`[PlaywrightRecorder] Trying to launch with channel: ${channel}`);
        opts.channel = channel;
      }

      let context;
      if (userDataDir) {
        context = await chromium.launchPersistentContext(userDataDir, opts);
      } else {
        const browser = await chromium.launch(opts);
        context = await browser.newContext(launchOptions);
        context._browser = browser;
      }

      console.log(`[PlaywrightRecorder] Successfully launched browser${channel ? ` with channel: ${channel}` : ''}`);
      return context;
    } catch (error) {
      lastError = error;
      console.log(`[PlaywrightRecorder] Failed to launch${channel ? ` with channel ${channel}` : ''}: ${error.message}`);
    }
  }

  throw new Error(`Failed to launch browser. Please install Chrome or Edge. Last error: ${lastError?.message}`);
}

module.exports = { launchBrowserWithFallback };
