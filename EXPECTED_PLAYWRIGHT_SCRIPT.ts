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
    const element = page.locator('INPUT#checkbox-84');
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
    const element = page.locator('INPUT#checkbox-84');
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
    const element = page.locator('INPUT#checkbox-87');
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
    const element = page.locator('INPUT#checkbox-87');
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



