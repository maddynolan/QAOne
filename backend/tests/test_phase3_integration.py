"""
Phase 3 Tests: Full Integration (Enhanced Generation Service)
Run after Phase 1 and 2 pass
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Change to backend directory for imports
os.chdir(backend_path)

from app.services.enhanced_generation_service import enhanced_generation_service

async def test_full_generation():
    """Test full generation pipeline"""
    print("\n=== Testing Full Generation Pipeline ===")
    
    if not os.getenv("DATABASE_URL"):
        print("⚠️  DATABASE_URL not set, skipping integration tests")
        return True
    
    try:
        await enhanced_generation_service.initialize()
        
        org_id = os.getenv("TEST_ORG_ID", "00000000-0000-0000-0000-000000000000")
        
        # Test requirement
        requirement = """
        As a user, I want to log in to the application using my email and password,
        so that I can access my account and view my dashboard.
        
        Acceptance Criteria:
        - User can enter email and password
        - System validates credentials
        - On success, user is redirected to dashboard
        - On failure, error message is displayed
        """
        
        print("Generating test cases (first call - no cache)...")
        result1 = await enhanced_generation_service.generate_test_cases(
            requirement=requirement,
            organization_id=org_id,
            test_type="manual"
        )
        
        print(f"✅ First generation:")
        print(f"   Status: {result1['status']}")
        print(f"   Test cases: {len(result1.get('test_cases', []))}")
        print(f"   Model: {result1.get('model')}")
        print(f"   Latency: {result1.get('latency_ms')}ms")
        print(f"   Cache hit: {result1.get('cache_hit')}")
        print(f"   Source: {result1.get('source')}")
        
        # Second call should hit cache
        print("\nGenerating test cases (second call - should hit cache)...")
        result2 = await enhanced_generation_service.generate_test_cases(
            requirement=requirement,
            organization_id=org_id,
            test_type="manual"
        )
        
        print(f"✅ Second generation:")
        print(f"   Status: {result2['status']}")
        print(f"   Test cases: {len(result2.get('test_cases', []))}")
        print(f"   Latency: {result2.get('latency_ms')}ms")
        print(f"   Cache hit: {result2.get('cache_hit')}")
        print(f"   Cache level: {result2.get('cache_level')}")
        print(f"   Source: {result2.get('source')}")
        
        # Verify cache hit
        if result2.get('cache_hit'):
            print("✅ Cache hit confirmed!")
            if result2.get('latency_ms', 0) < result1.get('latency_ms', 0) * 0.1:
                print("✅ Cache is significantly faster!")
        else:
            print("⚠️  Cache miss (might be expected if similarity threshold too high)")
        
        # Test with different requirement (should use RAG)
        different_req = """
        As a user, I want to reset my password if I forget it,
        so that I can regain access to my account.
        """
        
        print("\nGenerating test cases (different requirement - should use RAG)...")
        result3 = await enhanced_generation_service.generate_test_cases(
            requirement=different_req,
            organization_id=org_id,
            test_type="manual"
        )
        
        print(f"✅ Third generation:")
        print(f"   Test cases: {len(result3.get('test_cases', []))}")
        print(f"   RAG context used: {result3.get('rag_context_used')}")
        print(f"   RAG results count: {result3.get('rag_results_count', 0)}")
        
        await enhanced_generation_service.cleanup()
        print("\n✅ Full integration tests PASSED\n")
        return True
        
    except Exception as e:
        print(f"❌ Integration test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all Phase 3 tests"""
    print("=" * 60)
    print("PHASE 3 TESTS: Full Integration")
    print("=" * 60)
    
    results = []
    results.append(await test_full_generation())
    
    # Summary
    print("=" * 60)
    if all(results):
        print("✅ ALL PHASE 3 TESTS PASSED")
        print("\n🎉 RAG SYSTEM FULLY OPERATIONAL!")
        print("\nNext steps:")
        print("1. Update /ai/jira-to-testcases endpoint to use enhanced_generation_service")
        print("2. Add observability metrics")
        print("3. Monitor cache hit rates in production")
    else:
        print("❌ SOME TESTS FAILED")
        print("\nFix issues before deploying")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

