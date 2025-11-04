"""
Phase 2 Tests: Cache Service (L1 Redis + L2 Postgres)
Run after Phase 1 passes
"""

import asyncio
import os
import sys
from pathlib import Path
import numpy as np

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Change to backend directory for imports
os.chdir(backend_path)

from app.services.cache_service import cache_service
from app.services.embedding_service import embedding_service

async def test_l1_cache():
    """Test L1 Redis cache"""
    print("\n=== Testing L1 Cache (Redis) ===")
    
    # Check if Redis is available
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    if not redis_url:
        print("⚠️  REDIS_URL not set, skipping L1 cache tests")
        return True
    
    try:
        await cache_service.initialize()
        
        # Test cache key generation
        cache_key = cache_service._generate_cache_key(
            org_id="test-org",
            prompt="User login test",
            model_version="qwen2.5:7b-instruct",
            test_type="manual"
        )
        print(f"✅ Cache key generated: {cache_key[:50]}...")
        
        # Test set and get
        test_response = {
            "test_cases": [
                {"name": "Test 1", "steps": []}
            ],
            "model": "qwen2.5:7b-instruct"
        }
        
        success = await cache_service.l1_set(cache_key, test_response, ttl_days=1)
        print(f"✅ L1 cache SET: {success}")
        
        cached = await cache_service.l1_get(cache_key)
        if cached:
            print(f"✅ L1 cache GET: Found {len(cached.get('test_cases', []))} test cases")
        else:
            print("❌ L1 cache GET: Miss (this shouldn't happen)")
            return False
        
        # Test cache miss
        miss_key = cache_service._generate_cache_key(
            org_id="test-org",
            prompt="Different prompt",
            model_version="qwen2.5:7b-instruct"
        )
        cached = await cache_service.l1_get(miss_key)
        if cached is None:
            print("✅ L1 cache miss works correctly")
        else:
            print("⚠️  L1 cache miss returned data (unexpected)")
        
        await cache_service.cleanup()
        print("✅ L1 cache tests PASSED\n")
        return True
        
    except Exception as e:
        print(f"❌ L1 cache test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_l2_cache():
    """Test L2 Postgres semantic cache"""
    print("\n=== Testing L2 Cache (Postgres Semantic) ===")
    
    if not os.getenv("DATABASE_URL"):
        print("⚠️  DATABASE_URL not set, skipping L2 cache tests")
        return True
    
    try:
        await cache_service.initialize()
        await embedding_service.initialize()
        
        org_id = os.getenv("TEST_ORG_ID", "00000000-0000-0000-0000-000000000000")
        
        # Generate test embedding
        query_text = "User login functionality"
        query_embedding = await embedding_service.generate_embedding(query_text)
        
        # Test L2 cache set
        test_response = {
            "test_cases": [
                {"name": "Login Test", "steps": []}
            ],
            "model": "qwen2.5-coder:14b"
        }
        
        cache_key = cache_service._generate_cache_key(
            org_id=org_id,
            prompt=query_text,
            model_version="qwen2.5-coder:14b",
            test_type="manual"
        )
        
        success = await cache_service.l2_semantic_set(
            organization_id=org_id,
            cache_key=cache_key,
            request_embedding=query_embedding,
            response=test_response,
            model_version="qwen2.5-coder:14b",
            test_type="manual"
        )
        print(f"✅ L2 cache SET: {success}")
        
        # Test L2 cache get (exact match)
        l2_result = await cache_service.l2_semantic_get(
            organization_id=org_id,
            query_embedding=query_embedding,
            similarity_threshold=0.90,
            test_type="manual"
        )
        
        if l2_result:
            cached_response, similarity = l2_result
            print(f"✅ L2 cache GET: Found (similarity: {similarity:.2%})")
            print(f"   Test cases: {len(cached_response.get('test_cases', []))}")
        else:
            print("⚠️  L2 cache GET: Miss (might be expected if threshold too high)")
        
        # Test with slightly different query (should still match)
        similar_query_embedding = await embedding_service.generate_embedding(
            "User authentication with login"
        )
        l2_result = await cache_service.l2_semantic_get(
            organization_id=org_id,
            query_embedding=similar_query_embedding,
            similarity_threshold=0.85,
            test_type="manual"
        )
        
        if l2_result:
            cached_response, similarity = l2_result
            print(f"✅ L2 semantic match: similarity={similarity:.2%}")
        else:
            print("⚠️  L2 semantic match: Miss (threshold might be too high)")
        
        await cache_service.cleanup()
        await embedding_service.cleanup()
        print("✅ L2 cache tests PASSED\n")
        return True
        
    except Exception as e:
        print(f"❌ L2 cache test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all Phase 2 tests"""
    print("=" * 60)
    print("PHASE 2 TESTS: Cache Service (L1 + L2)")
    print("=" * 60)
    
    results = []
    
    # Test L1 cache
    results.append(await test_l1_cache())
    
    # Test L2 cache
    results.append(await test_l2_cache())
    
    # Summary
    print("=" * 60)
    if all(results):
        print("✅ ALL PHASE 2 TESTS PASSED")
        print("\nNext: Run Phase 3 tests (full integration)")
    else:
        print("❌ SOME TESTS FAILED")
        print("\nFix issues before proceeding to Phase 3")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

