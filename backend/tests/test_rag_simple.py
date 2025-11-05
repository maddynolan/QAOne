"""
Simple RAG System Test - Works without all dependencies
Tests what we can without requiring DATABASE_URL, Redis, etc.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))
os.chdir(backend_path)

def test_imports():
    """Test that all modules can be imported"""
    print("\n=== Testing Imports ===")
    try:
        from app.services.embedding_service import embedding_service
        print("[OK] Embedding service imported")
        
        from app.services.rag_service import rag_service
        print("[OK] RAG service imported")
        
        from app.services.cache_service import cache_service
        print("[OK] Cache service imported")
        
        from app.services.model_router import model_router, ModelChoice
        print("[OK] Model router imported")
        
        from app.services.enhanced_generation_service import enhanced_generation_service
        print("[OK] Enhanced generation service imported")
        
        return True
    except Exception as e:
        print(f"[FAIL] Import error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_embedding_service_init():
    """Test embedding service initialization"""
    print("\n=== Testing Embedding Service Initialization ===")
    try:
        from app.services.embedding_service import embedding_service
        
        # Test normalization
        normalized = embedding_service.normalize_text_for_embedding(
            "User ID: abc-123-def, Date: 2024-01-15"
        )
        print(f"[OK] Text normalization works: '{normalized}'")
        
        # Test checksum
        checksum = embedding_service.generate_checksum("Test requirement")
        print(f"[OK] Checksum generation works: {checksum[:16]}...")
        
        # Check if dependencies are available
        has_sentence_transformers = False
        try:
            import sentence_transformers
            has_sentence_transformers = True
            print("[OK] sentence-transformers is installed")
        except ImportError:
            print("[SKIP] sentence-transformers not installed (optional)")
        
        # Check Ollama URL
        ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        print(f"[INFO] Ollama URL: {ollama_url}")
        
        return True
    except Exception as e:
        print(f"[FAIL] Embedding service test error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_model_router():
    """Test model router logic"""
    print("\n=== Testing Model Router ===")
    try:
        from app.services.model_router import model_router, ModelChoice
        
        # Test simple prompt (should route to 7B if RAG is good)
        simple_prompt = "User login test"
        rag_results = [
            {"similarity": 0.85}, {"similarity": 0.82}, 
            {"similarity": 0.88}, {"similarity": 0.90}
        ]
        
        choice = model_router.choose_model(
            prompt=simple_prompt,
            rag_results=rag_results,
            test_type="manual"
        )
        print(f"[OK] Model routing works: {choice.value} for simple prompt")
        
        # Test security keyword (should route to 14B)
        security_prompt = "User authentication with password security"
        choice2 = model_router.choose_model(
            prompt=security_prompt,
            rag_results=rag_results,
            test_type="manual"
        )
        print(f"[OK] Security prompt routes to: {choice2.value}")
        
        # Test user override
        choice3 = model_router.choose_model(
            prompt=simple_prompt,
            user_override="quick"
        )
        print(f"[OK] User override works: {choice3.value}")
        
        # Test model info
        info = model_router.get_model_info(choice)
        print(f"[OK] Model info: {info['model']} ({info['estimated_latency']})")
        
        return True
    except Exception as e:
        print(f"[FAIL] Model router test error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_cache_key_generation():
    """Test cache key generation"""
    print("\n=== Testing Cache Key Generation ===")
    try:
        from app.services.cache_service import cache_service
        
        cache_key = cache_service._generate_cache_key(
            org_id="test-org-123",
            prompt="User login test case",
            model_version="qwen2.5:7b-instruct",
            test_type="manual"
        )
        print(f"[OK] Cache key generated: {cache_key[:60]}...")
        
        # Test deterministic
        cache_key2 = cache_service._generate_cache_key(
            org_id="test-org-123",
            prompt="User login test case",
            model_version="qwen2.5:7b-instruct",
            test_type="manual"
        )
        
        if cache_key == cache_key2:
            print("[OK] Cache keys are deterministic")
        else:
            print("[FAIL] Cache keys are not deterministic!")
            return False
        
        return True
    except Exception as e:
        print(f"[FAIL] Cache key test error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_services_without_database():
    """Test that services can be initialized without database"""
    print("\n=== Testing Service Initialization (No DB) ===")
    try:
        # Clear DATABASE_URL to test graceful handling
        original_db = os.environ.get("DATABASE_URL")
        if "DATABASE_URL" in os.environ:
            del os.environ["DATABASE_URL"]
        
        # Re-import to get fresh instances
        import importlib
        import app.services.rag_service as rag_module
        import app.services.cache_service as cache_module
        
        importlib.reload(rag_module)
        importlib.reload(cache_module)
        
        rag = rag_module.RAGService()
        print("[OK] RAG service initialized without DATABASE_URL")
        
        cache = cache_module.CacheService()
        print("[OK] Cache service initialized without DATABASE_URL")
        
        # Restore
        if original_db:
            os.environ["DATABASE_URL"] = original_db
        
        return True
    except Exception as e:
        print(f"[FAIL] Service initialization test error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("=" * 70)
    print("RAG SYSTEM - SIMPLE TESTS (No Database Required)")
    print("=" * 70)
    print("\nThese tests verify:")
    print("1. All modules can be imported")
    print("2. Services initialize correctly")
    print("3. Model routing logic works")
    print("4. Cache key generation is deterministic")
    print("\nFor full tests with database, run:")
    print("  python tests/test_phase1_rag.py")
    print("  python tests/test_phase2_caching.py")
    print("  python tests/test_phase3_integration.py")
    print("=" * 70)
    
    results = []
    
    results.append(("Imports", test_imports()))
    results.append(("Embedding Service Init", test_embedding_service_init()))
    results.append(("Model Router", test_model_router()))
    results.append(("Cache Key Generation", test_cache_key_generation()))
    results.append(("Service Init (No DB)", test_services_without_database()))
    
    # Summary
    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} {name}")
    
    all_passed = all(r[1] for r in results)
    print("=" * 70)
    
    if all_passed:
        print("\n[SUCCESS] All basic tests passed!")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Set DATABASE_URL in .env file")
        print("3. Run migration: psql $DATABASE_URL -f supabase/migrations/007_rag_foundation.sql")
        print("4. Run full tests: python tests/test_phase1_rag.py")
    else:
        print("\n[WARNING] Some tests failed. Review errors above.")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)


