"""
Phase 1 Tests: Embedding Service and RAG Service
Run after running migration 007_rag_foundation.sql
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

from app.services.embedding_service import embedding_service
from app.services.rag_service import rag_service

async def test_embedding_service():
    """Test embedding generation"""
    print("\n=== Testing Embedding Service ===")
    
    try:
        await embedding_service.initialize()
        
        # Test single embedding
        text = "User login functionality with email and password"
        embedding = await embedding_service.generate_embedding(text)
        
        print(f"[OK] Embedding generated: shape={embedding.shape}, dtype={embedding.dtype}")
        print(f"   First 5 values: {embedding[:5]}")
        
        # Test batch embeddings
        texts = [
            "User login test",
            "Shopping cart functionality",
            "Payment processing"
        ]
        embeddings = await embedding_service.generate_embeddings_batch(texts)
        
        print(f"[OK] Batch embeddings: {len(embeddings)} embeddings")
        for i, emb in enumerate(embeddings):
            print(f"   Text {i+1}: shape={emb.shape}")
        
        # Test normalization
        normalized = embedding_service.normalize_text_for_embedding(
            "User ID: abc-123-def, Date: 2024-01-15"
        )
        print(f"[OK] Normalization: '{normalized}'")
        
        # Test checksum
        checksum = embedding_service.generate_checksum("Test requirement")
        print(f"[OK] Checksum generated: {checksum[:16]}...")
        
        await embedding_service.cleanup()
        print("[PASS] Embedding service tests PASSED\n")
        return True
        
    except Exception as e:
        print(f"[FAIL] Embedding service test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_rag_service():
    """Test RAG retrieval"""
    print("\n=== Testing RAG Service ===")
    
    # Check if DATABASE_URL is set
    if not os.getenv("DATABASE_URL"):
        print("⚠️  DATABASE_URL not set, skipping RAG tests")
        print("   Set DATABASE_URL to test RAG service")
        return True
    
    try:
        # Get a test organization ID (you'll need to provide a real one)
        org_id = os.getenv("TEST_ORG_ID", "00000000-0000-0000-0000-000000000000")
        
        # Generate test query embedding
        await embedding_service.initialize()
        query_embedding = await embedding_service.generate_embedding("User login test case")
        
        # Test RAG search
        results = await rag_service.search_similar_requirements(
            organization_id=org_id,
            query_embedding=query_embedding,
            limit=5
        )
        
        print(f"[OK] RAG search completed: {len(results)} results")
        for i, result in enumerate(results[:3], 1):
            print(f"   {i}. {result.get('title', 'N/A')[:50]} (similarity: {result.get('similarity', 0):.2%})")
        
        # Test context building
        context = await rag_service.build_rag_context(
            organization_id=org_id,
            query_embedding=query_embedding,
            limit=3
        )
        print(f"[OK] Context built: {len(context)} characters")
        
        # Test stats
        stats = await rag_service.get_rag_stats(org_id)
        print(f"[OK] RAG stats: {stats}")
        
        await embedding_service.cleanup()
        print("[PASS] RAG service tests PASSED\n")
        return True
        
    except Exception as e:
        print(f"[FAIL] RAG service test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all Phase 1 tests"""
    print("=" * 60)
    print("PHASE 1 TESTS: Embedding Service + RAG Service")
    print("=" * 60)
    
    results = []
    
    # Test embedding service
    results.append(await test_embedding_service())
    
    # Test RAG service
    results.append(await test_rag_service())
    
    # Summary
    print("=" * 60)
    if all(results):
        print("[SUCCESS] ALL PHASE 1 TESTS PASSED")
        print("\nNext: Run Phase 2 tests (caching)")
    else:
        print("[FAILED] SOME TESTS FAILED")
        print("\nFix issues before proceeding to Phase 2")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

