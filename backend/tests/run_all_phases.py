"""
Run all RAG tests in sequence
Usage: python backend/tests/run_all_phases.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Change to backend directory for imports
import os
os.chdir(backend_path)

async def run_phase1():
    """Run Phase 1 tests"""
    print("\n" + "="*70)
    print("PHASE 1: Embedding Service + RAG Service")
    print("="*70)
    
    from test_phase1_rag import main as phase1_main
    try:
        await phase1_main()
        return True
    except Exception as e:
        print(f"❌ Phase 1 failed: {e}")
        return False

async def run_phase2():
    """Run Phase 2 tests"""
    print("\n" + "="*70)
    print("PHASE 2: Cache Service (L1 Redis + L2 Postgres)")
    print("="*70)
    
    from test_phase2_caching import main as phase2_main
    try:
        await phase2_main()
        return True
    except Exception as e:
        print(f"❌ Phase 2 failed: {e}")
        return False

async def run_phase3():
    """Run Phase 3 tests"""
    print("\n" + "="*70)
    print("PHASE 3: Full Integration")
    print("="*70)
    
    from test_phase3_integration import main as phase3_main
    try:
        await phase3_main()
        return True
    except Exception as e:
        print(f"❌ Phase 3 failed: {e}")
        return False

async def main():
    """Run all phases"""
    print("\n" + "="*70)
    print("RAG SYSTEM - COMPLETE TEST SUITE")
    print("="*70)
    print("\nPrerequisites:")
    print("1. Run migration: psql $DATABASE_URL -f supabase/migrations/007_rag_foundation.sql")
    print("2. Set DATABASE_URL environment variable")
    print("3. Set REDIS_URL (optional, for L1 cache tests)")
    print("4. Set TEST_ORG_ID (optional, for real org tests)")
    print("\nStarting tests...\n")
    
    results = {}
    
    # Phase 1
    print("\n>>> Starting Phase 1...")
    results['phase1'] = await run_phase1()
    
    if not results['phase1']:
        print("\n⚠️  Phase 1 failed. Fix issues before continuing.")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return
    
    # Phase 2
    print("\n>>> Starting Phase 2...")
    results['phase2'] = await run_phase2()
    
    if not results['phase2']:
        print("\n⚠️  Phase 2 failed. Fix issues before continuing.")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return
    
    # Phase 3
    print("\n>>> Starting Phase 3...")
    results['phase3'] = await run_phase3()
    
    # Final summary
    print("\n" + "="*70)
    print("FINAL RESULTS")
    print("="*70)
    print(f"Phase 1 (Embedding + RAG): {'✅ PASSED' if results['phase1'] else '❌ FAILED'}")
    print(f"Phase 2 (Caching):          {'✅ PASSED' if results['phase2'] else '❌ FAILED'}")
    print(f"Phase 3 (Integration):      {'✅ PASSED' if results['phase3'] else '❌ FAILED'}")
    
    if all(results.values()):
        print("\n🎉 ALL TESTS PASSED! RAG SYSTEM IS READY!")
        print("\nNext steps:")
        print("1. Set USE_ENHANCED_GENERATION=true in backend/.env")
        print("2. Restart backend server")
        print("3. Test /ai/jira-to-testcases endpoint")
        print("4. Monitor cache hit rates")
    else:
        print("\n⚠️  Some tests failed. Review errors above.")
    print("="*70)

if __name__ == "__main__":
    asyncio.run(main())

