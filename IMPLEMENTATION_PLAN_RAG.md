# RAG Implementation Plan - Phase 1 Complete ✅

## ✅ What We Just Built

### 1. Database Schema (Migration 007)
- ✅ `requirement_embeddings` table with pgvector
- ✅ `cached_responses` table for L2 semantic cache
- ✅ Vector indexes (IVFFlat) for fast similarity search
- ✅ Added `body_clean` and `checksum` to requirements

### 2. Embedding Service
- ✅ CPU-based embedding generation
- ✅ Supports Ollama embeddings API
- ✅ Supports HuggingFace sentence-transformers (local)
- ✅ Batch processing for CSV ingestion
- ✅ Text normalization (removes IDs, dates)

### 3. RAG Service
- ✅ Semantic search over requirement embeddings
- ✅ Cosine similarity matching
- ✅ Context building for LLM prompts
- ✅ Organization/project filtering
- ✅ Statistics tracking

---

## 🚀 Next Steps (Phase 2)

### 1. Install Dependencies
```bash
cd backend
pip install sentence-transformers  # For local embeddings
# OR use Ollama embeddings (already available)
```

### 2. Run Migration
```bash
# Connect to your Postgres and run:
psql $DATABASE_URL -f supabase/migrations/007_rag_foundation.sql
```

### 3. Set Environment Variables
```bash
# backend/.env
EMBEDDING_MODEL=all-MiniLM-L6-v2  # or nomic-embed-text
EMBEDDING_DIM=384  # 384 for MiniLM, 768 for nomic-embed
USE_OLLAMA_EMBEDDINGS=false  # Set to true to use Ollama
OLLAMA_EMBED_MODEL=nomic-embed-text  # If using Ollama
```

### 4. Test Embedding Service
```python
# Test script
from app.services.embedding_service import embedding_service
import asyncio

async def test():
    await embedding_service.initialize()
    embedding = await embedding_service.generate_embedding("User login test case")
    print(f"Embedding shape: {embedding.shape}")
    await embedding_service.cleanup()

asyncio.run(test())
```

### 5. Test RAG Service
```python
# Test script
from app.services.rag_service import rag_service
from app.services.embedding_service import embedding_service
import asyncio

async def test():
    await embedding_service.initialize()
    query_emb = await embedding_service.generate_embedding("User login functionality")
    
    results = await rag_service.search_similar_requirements(
        organization_id="your-org-id",
        query_embedding=query_emb,
        limit=5
    )
    
    print(f"Found {len(results)} similar requirements")
    for r in results:
        print(f"  - {r['title']} (similarity: {r['similarity']:.2%})")
    
    await embedding_service.cleanup()

asyncio.run(test())
```

---

## 📋 Phase 2 Tasks (Coming Next)

1. **Redis L1 Cache Service** - Fast exact match caching
2. **L2 Semantic Cache Service** - Postgres-based similarity cache
3. **Update Requirements Ingestion** - Auto-generate embeddings
4. **Update Test Generation Endpoint** - Integrate RAG + caching

---

## 🎯 Expected Results

Once Phase 2 is complete:
- **60-80% cache hit rate** (L1 + L2 combined)
- **5-15s latency** for fresh generations (vs 15-25s now)
- **60-80% GPU cost reduction** (from caching)
- **Better context-aware** test case generation (from RAG)

---

## 📝 Notes

- Start with **384-dim embeddings** (all-MiniLM-L6-v2) - fast and good quality
- Can upgrade to **768-dim** (nomic-embed-text) later if needed
- Vector indexes will auto-update as you add embeddings
- Monitor cache hit rates and adjust thresholds

Ready for Phase 2? 🚀

