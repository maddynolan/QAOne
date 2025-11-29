"""Quick script to run the Flowstral generated test"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.automation.test_execution_service import get_test_execution_service

test_code = """import { test, expect } from '@playwright/test';

test('Flowstral Recorded Test', async ({ page }) => {
  await page.goto("https://www.walmart.com/");
  await page.click(".ld.ld-ChevronDown.pl2");
  await page.click(".mid-gray.no-underline.subcategory-item-link");
  await page.click(".mr2");
  await page.click(".mr2");
  await page.click("#cart-button-header");
  await page.click(".w_hhLG.w_DZvO.w_0_LY.bn.sans-serif.pa0.bg-transparent.tc.f6.black.underline.w5.mr4.mr5.pa1");
  await page.click("#Continue to checkout button");
});
"""

async def main():
    print("[RUN] Running Flowstral Generated Test...")
    print("=" * 60)
    
    service = get_test_execution_service()
    
    try:
        result = await service.execute_test(
            test_code=test_code,
            test_name="Flowstral Recorded Test",
            browser="chromium",
            headless=False,  # Run in headed mode so you can see it
            timeout=60000  # 60 seconds
        )
        
        print("\n[OK] Test Execution Complete!")
        print("=" * 60)
        print(f"Status: {result['status']}")
        print(f"Exit Code: {result.get('exit_code', 'N/A')}")
        print(f"Execution Time: {result.get('execution_time_seconds', 0):.2f} seconds")
        
        if result.get('stdout'):
            print(f"\n[STDOUT] Stdout (first 1000 chars):")
            print(result['stdout'][:1000])
        
        if result.get('stderr'):
            print(f"\n[STDERR] Stderr (first 1000 chars):")
            print(result['stderr'][:1000])
        
        if result.get('error'):
            print(f"\n[ERROR] Error:")
            print(result['error'])
        
        if result.get('screenshots'):
            print(f"\n[SCREENSHOTS] Screenshots captured: {len(result['screenshots'])}")
        
        if result.get('video'):
            print(f"\n[VIDEO] Video captured: {result['video']}")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n[ERROR] Error running test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())

