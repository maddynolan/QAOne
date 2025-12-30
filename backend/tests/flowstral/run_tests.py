#!/usr/bin/env python3
"""
Quick test runner for Playwright Generator
Run this to test the generator without full backend setup.
"""

import sys
import asyncio
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

from tests.flowstral.test_harness import PlaywrightGeneratorTestHarness


async def main():
    """Main entry point"""
    print("=" * 60)
    print("Playwright Generator Test Runner")
    print("=" * 60)
    print()
    
    harness = PlaywrightGeneratorTestHarness()
    
    # Run all tests
    await harness.run_all_tests()
    
    # Save results
    harness.save_results("test_results.json")
    
    # Exit with appropriate code
    failed = sum(1 for r in harness.results if not r["success"])
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    asyncio.run(main())



