# Expected Playwright Script Output

Based on the action graph with the following nodes:
- navigate to `https://my.nmdp.org/s/?language=en_US`
- click on `span.slds-checkbox_faux`
- click on `INPUT#checkbox-84`
- input value `true` into `INPUT#checkbox-84`
- click on `span.slds-checkbox_faux`
- click on `INPUT#checkbox-87`
- input value `true` into `INPUT#checkbox-87`

## Expected Generated Playwright Script:

```typescript
import { test, expect } from '@playwright/test';

// Configuration
const ACTION_TIMEOUT = 10000;  // 10 seconds
const NETWORK_TIMEOUT = 3000;  // 3 seconds

test('Flowstral Recorded Test', async ({ page }) => {
  // Navigate to initial page
  await page.goto('https://my.nmdp.org/s/?language=en_US');
  await page.waitForLoadState('networkidle');

  // Step: Click - CLICK: SPAN span.slds-checkbox_faux
  try {
    const element = page.locator('span.slds-checkbox_faux');
    await element.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    await element.click();
    // Wait for any side effects
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT }).catch(() => {}),
      page.waitForTimeout(500)
    ]);
  } catch (finalError) {
    await page.screenshot({ path: `failure-step-0.png`, fullPage: true });
    throw new Error(`Step 0 failed: Could not click element - ${finalError.message}`);
  }

  // Step: Click - CLICK: INPUT#checkbox-84
  try {
    const element = page.locator('#checkbox-84');
    await element.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    await element.click();
    // Wait for any side effects
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT }).catch(() => {}),
      page.waitForTimeout(500)
    ]);
  } catch (finalError) {
    await page.screenshot({ path: `failure-step-1.png`, fullPage: true });
    throw new Error(`Step 1 failed: Could not click element - ${finalError.message}`);
  }

  // Step: Fill - FILL_INPUT: INPUT#checkbox-84[Blood_Cancer_or_Disorder__c]
  try {
    const element = page.locator('#checkbox-84');
    await element.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
    await expect(element).toBeVisible();
    await element.clear();
    await element.fill('true');
    await expect(element).toHaveValue('true');
  } catch (finalError) {
    await page.screenshot({ path: `failure-step-2.png`, fullPage: true });
    throw new Error(`Step 2 failed: Could not fill input - ${finalError.message}`);
  }

  // Step: Click - CLICK: SPAN span.slds-checkbox_faux
  try {
    const element = page.locator('span.slds-checkbox_faux');
    await element.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    await element.click();
    // Wait for any side effects
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT }).catch(() => {}),
      page.waitForTimeout(500)
    ]);
  } catch (finalError) {
    await page.screenshot({ path: `failure-step-3.png`, fullPage: true });
    throw new Error(`Step 3 failed: Could not click element - ${finalError.message}`);
  }

  // Step: Click - CLICK: INPUT#checkbox-87
  try {
    const element = page.locator('#checkbox-87');
    await element.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    await element.click();
    // Wait for any side effects
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT }).catch(() => {}),
      page.waitForTimeout(500)
    ]);
  } catch (finalError) {
    await page.screenshot({ path: `failure-step-4.png`, fullPage: true });
    throw new Error(`Step 4 failed: Could not click element - ${finalError.message}`);
  }

  // Step: Fill - FILL_INPUT: INPUT#checkbox-87[Brain_Injury_Concussion_or_Surgery__c]
  try {
    const element = page.locator('#checkbox-87');
    await element.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
    await expect(element).toBeVisible();
    await element.clear();
    await element.fill('true');
    await expect(element).toHaveValue('true');
  } catch (finalError) {
    await page.screenshot({ path: `failure-step-5.png`, fullPage: true });
    throw new Error(`Step 5 failed: Could not fill input - ${finalError.message}`);
  }
});
```

## Key Points:

1. **Navigation**: Uses the first URL from the action graph
2. **Click Actions**: Uses `target_selector` directly wrapped in `page.locator()`
   - `span.slds-checkbox_faux` → `page.locator('span.slds-checkbox_faux')`
   - `INPUT#checkbox-84` → `page.locator('#checkbox-84')` (simplified from `INPUT#checkbox-84`)
3. **Input Actions**: Uses the selector and fills with the value from metadata
4. **Error Handling**: Each action has try-catch with screenshot on failure
5. **Network Synchronization**: Waits for networkidle after clicks
6. **Assertions**: Checks visibility and enabled state before clicking

## What Should Be Generated:

- **Action Count**: 6 (1 navigate + 3 clicks + 2 inputs, excluding session_start/end)
- **Strategies Used**: `css_selector`, `network_synchronization`
- **No warnings** if all nodes have valid `target_selector`



