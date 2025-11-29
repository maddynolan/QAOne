"""
Embedding Service for RAG
Generates embeddings for requirements and queries using CPU-based models
"""

import logging
import os
import aiohttp
import numpy as np
from typing import List, Optional, Union
import hashlib

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service to generate embeddings for RAG using CPU-based models"""
    
    def __init__(self):
        # Embedding model selection
        # Option 1: Hugging Face sentence-transformers (local)
        # Option 2: Ollama embeddings endpoint
        # Option 3: OpenAI embeddings (if needed)
        
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        self.embedding_dim = int(os.getenv("EMBEDDING_DIM", "384"))  # 384 for MiniLM, 768 for nomic-embed
        
        # Try Ollama first (if available), fallback to HuggingFace
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.use_ollama = os.getenv("USE_OLLAMA_EMBEDDINGS", "false").lower() == "true"
        
        # Ollama embedding model
        self.ollama_embed_model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
        
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def initialize(self):
        """Initialize HTTP session"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
    
    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def generate_embedding(self, text: str) -> np.ndarray:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
            
        Returns:
            numpy array of embedding vector
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        if not self.session:
            await self.initialize()
        
        # Use Ollama if enabled
        if self.use_ollama:
            try:
                return await self._generate_ollama_embedding(text)
            except Exception as e:
                logger.warning(f"Ollama embedding failed, falling back to HuggingFace: {e}")
                # Fall through to HuggingFace
        
        # Use HuggingFace sentence-transformers (local)
        return await self._generate_hf_embedding(text)
    
    async def generate_embeddings_batch(self, texts: List[str]) -> List[np.ndarray]:
        """
        Generate embeddings for multiple texts (batch processing)
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of numpy arrays
        """
        if not texts:
            return []
        
        if not self.session:
            await self.initialize()
        
        # Use Ollama if enabled (supports batch)
        if self.use_ollama:
            try:
                return await self._generate_ollama_embeddings_batch(texts)
            except Exception as e:
                logger.warning(f"Ollama batch embedding failed, falling back to HuggingFace: {e}")
        
        # HuggingFace: process in batches of 32
        batch_size = 32
        results = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = await self._generate_hf_embeddings_batch(batch)
            results.extend(batch_embeddings)
        
        return results
    
    async def _generate_ollama_embedding(self, text: str) -> np.ndarray:
        """Generate embedding using Ollama API"""
        url = f"{self.ollama_url}/api/embeddings"
        
        payload = {
            "model": self.ollama_embed_model,
            "prompt": text
        }
        
        async with self.session.post(url, json=payload) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"Ollama embedding failed: {response.status} - {error_text}")
            
            data = await response.json()
            embedding = data.get("embedding", [])
            
            if not embedding:
                raise Exception("No embedding returned from Ollama")
            
            return np.array(embedding, dtype=np.float32)
    
    async def _generate_ollama_embeddings_batch(self, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings for batch using Ollama"""
        # Ollama doesn't natively support batch, but we can parallelize
        import asyncio
        
        tasks = [self._generate_ollama_embedding(text) for text in texts]
        return await asyncio.gather(*tasks)
    
    async def _generate_hf_embedding(self, text: str) -> np.ndarray:
        """
        Generate embedding using HuggingFace sentence-transformers
        This requires the model to be installed locally
        """
        try:
            from sentence_transformers import SentenceTransformer
            
            # Lazy load model (cache it)
            if not hasattr(self, '_hf_model'):
                logger.info(f"Loading HuggingFace model: {self.embedding_model}")
                self._hf_model = SentenceTransformer(self.embedding_model)
            
            # Generate embedding
            embedding = self._hf_model.encode(text, normalize_embeddings=True)
            return np.array(embedding, dtype=np.float32)
            
        except ImportError:
            raise ImportError(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )
        except Exception as e:
            logger.error(f"HF embedding generation failed: {e}")
            raise
    
    async def _generate_hf_embeddings_batch(self, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings for batch using HuggingFace"""
        try:
            from sentence_transformers import SentenceTransformer
            
            if not hasattr(self, '_hf_model'):
                logger.info(f"Loading HuggingFace model: {self.embedding_model}")
                self._hf_model = SentenceTransformer(self.embedding_model)
            
            # Batch encode
            embeddings = self._hf_model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return [np.array(emb, dtype=np.float32) for emb in embeddings]
            
        except ImportError:
            raise ImportError("sentence-transformers not installed")
        except Exception as e:
            logger.error(f"HF batch embedding generation failed: {e}")
            raise
    
    def normalize_text_for_embedding(self, text: str) -> str:
        """
        Normalize text for embedding (remove IDs, normalize dates, etc.)
        This improves RAG quality by focusing on semantic meaning
        """
        import re
        
        # Remove UUIDs
        text = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '[ID]', text, flags=re.IGNORECASE)
        
        # Normalize dates (YYYY-MM-DD, MM/DD/YYYY, etc. -> [DATE])
        text = re.sub(r'\d{4}-\d{2}-\d{2}', '[DATE]', text)
        text = re.sub(r'\d{2}/\d{2}/\d{4}', '[DATE]', text)
        
        # Normalize times
        text = re.sub(r'\d{1,2}:\d{2}(:\d{2})?', '[TIME]', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text.strip()
    
    def generate_checksum(self, text: str) -> str:
        """Generate checksum for change detection"""
        normalized = self.normalize_text_for_embedding(text)
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


# Global instance
embedding_service = EmbeddingService()


