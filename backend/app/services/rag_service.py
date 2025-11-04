"""
RAG Service - Retrieval Augmented Generation
Handles semantic search over requirement embeddings
"""

import logging
import os
import asyncpg
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

class RAGService:
    """Service for RAG retrieval using pgvector"""
    
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL")
        # Don't raise error on init - allow lazy initialization
    
    async def get_connection(self):
        """Get database connection"""
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required. Set it in .env file or environment.")
        return await asyncpg.connect(self.database_url)
    
    async def search_similar_requirements(
        self,
        organization_id: str,
        query_embedding: np.ndarray,
        limit: int = 5,
        similarity_threshold: float = 0.7,
        project_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar requirements using cosine similarity
        
        Args:
            organization_id: Organization ID to filter by
            query_embedding: Query embedding vector
            limit: Maximum number of results
            similarity_threshold: Minimum similarity score (0-1)
            project_id: Optional project filter
            
        Returns:
            List of requirement dictionaries with similarity scores
        """
        conn = await self.get_connection()
        
        try:
            # Convert numpy array to PostgreSQL vector format
            embedding_str = '[' + ','.join(map(str, query_embedding.tolist())) + ']'
            
            # Build query with optional project filter
            if project_id:
                query = """
                    SELECT 
                        r.id,
                        r.project_id,
                        r.title,
                        r.description,
                        r.body_clean,
                        r.source,
                        r.source_ref,
                        r.labels,
                        1 - (re.embedding <=> $1::vector) as similarity
                    FROM requirement_embeddings re
                    JOIN requirements r ON re.requirement_id = r.id
                    WHERE re.organization_id = $2::uuid
                      AND re.project_id = $3::uuid
                      AND 1 - (re.embedding <=> $1::vector) >= $4
                    ORDER BY re.embedding <=> $1::vector
                    LIMIT $5
                """
                params = [embedding_str, organization_id, project_id, similarity_threshold, limit]
            else:
                query = """
                    SELECT 
                        r.id,
                        r.project_id,
                        r.title,
                        r.description,
                        r.body_clean,
                        r.source,
                        r.source_ref,
                        r.labels,
                        1 - (re.embedding <=> $1::vector) as similarity
                    FROM requirement_embeddings re
                    JOIN requirements r ON re.requirement_id = r.id
                    WHERE re.organization_id = $2::uuid
                      AND 1 - (re.embedding <=> $1::vector) >= $3
                    ORDER BY re.embedding <=> $1::vector
                    LIMIT $4
                """
                params = [embedding_str, organization_id, similarity_threshold, limit]
            
            rows = await conn.fetch(query, *params)
            
            results = []
            for row in rows:
                results.append({
                    'id': str(row['id']),
                    'project_id': str(row['project_id']) if row['project_id'] else None,
                    'title': row['title'],
                    'description': row['description'],
                    'body_clean': row['body_clean'],
                    'source': row['source'],
                    'source_ref': row['source_ref'],
                    'labels': row['labels'] or [],
                    'similarity': float(row['similarity'])
                })
            
            return results
            
        except Exception as e:
            logger.error(f"RAG search failed: {e}")
            raise
        finally:
            await conn.close()
    
    async def build_rag_context(
        self,
        organization_id: str,
        query_embedding: np.ndarray,
        limit: int = 5,
        project_id: Optional[str] = None
    ) -> str:
        """
        Build RAG context string from similar requirements
        
        Args:
            organization_id: Organization ID
            query_embedding: Query embedding
            limit: Number of similar requirements to retrieve
            project_id: Optional project filter
            
        Returns:
            Formatted context string for LLM prompt
        """
        similar_reqs = await self.search_similar_requirements(
            organization_id=organization_id,
            query_embedding=query_embedding,
            limit=limit,
            project_id=project_id
        )
        
        if not similar_reqs:
            return "No similar requirements found in knowledge base."
        
        context_parts = ["Similar requirements from knowledge base:"]
        
        for i, req in enumerate(similar_reqs, 1):
            context_parts.append(f"\n{i}. [{req['source_ref'] or 'N/A'}] {req['title']}")
            if req['description']:
                context_parts.append(f"   {req['description'][:200]}...")  # Truncate long descriptions
            if req['labels']:
                context_parts.append(f"   Tags: {', '.join(req['labels'])}")
            context_parts.append(f"   Similarity: {req['similarity']:.2%}")
        
        return "\n".join(context_parts)
    
    async def get_rag_stats(self, organization_id: str) -> Dict[str, Any]:
        """Get RAG statistics for an organization"""
        conn = await self.get_connection()
        
        try:
            stats_query = """
                SELECT 
                    COUNT(*) as total_requirements,
                    COUNT(DISTINCT re.requirement_id) as embedded_requirements,
                    COUNT(DISTINCT re.project_id) as projects_with_embeddings
                FROM requirements r
                LEFT JOIN requirement_embeddings re ON r.id = re.requirement_id
                WHERE r.project_id IN (
                    SELECT id FROM projects WHERE org_id = $1::uuid
                )
            """
            
            row = await conn.fetchrow(stats_query, organization_id)
            
            return {
                'total_requirements': row['total_requirements'],
                'embedded_requirements': row['embedded_requirements'],
                'projects_with_embeddings': row['projects_with_embeddings'],
                'coverage_percentage': (
                    (row['embedded_requirements'] / row['total_requirements'] * 100)
                    if row['total_requirements'] > 0 else 0
                )
            }
            
        except Exception as e:
            logger.error(f"Failed to get RAG stats: {e}")
            return {}
        finally:
            await conn.close()


# Global instance
rag_service = RAGService()

