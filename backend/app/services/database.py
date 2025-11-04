"""
Database connection service for PostgreSQL/Supabase
Handles connections and basic queries
Supports both direct Postgres and Supabase
"""

import os
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Try direct Postgres first (for hybrid approach)
try:
    from app.services.postgres_direct import get_postgres_pool, test_connection as test_postgres_connection
    POSTGRES_DIRECT_AVAILABLE = True
except ImportError:
    POSTGRES_DIRECT_AVAILABLE = False
    logger.warning("psycopg2 not installed. Install with: pip install psycopg2-binary")

# Fallback to Supabase if needed
try:
    from supabase import create_client, Client
    
    def get_supabase_client() -> Optional[Client]:
        """Get Supabase client if configured"""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if supabase_url and supabase_key:
            try:
                return create_client(supabase_url, supabase_key)
            except Exception as e:
                logger.error(f"Failed to create Supabase client: {str(e)}")
                return None
        return None
except ImportError:
    def get_supabase_client():
        return None


def get_database_client() -> Optional[Any]:
    """
    Get database client - prefers direct Postgres, falls back to Supabase
    Returns: Postgres pool or Supabase client or None
    """
    # Prefer direct Postgres connection (for hybrid approach)
    if POSTGRES_DIRECT_AVAILABLE:
        pool = get_postgres_pool()
        if pool:
            logger.info("Using direct PostgreSQL connection")
            return pool
    
    # Fallback to Supabase
    client = get_supabase_client()
    if client:
        logger.info("Using Supabase client")
        return client
    
    logger.warning("No database connection configured")
    return None


async def execute_migration(migration_sql: str) -> bool:
    """Execute a SQL migration"""
    try:
        client = get_database_client()
        if not client:
            logger.warning("No database client available. Skipping migration.")
            return False
        
        # Supabase doesn't support direct SQL execution via Python client
        # Migrations should be run via Supabase CLI or dashboard
        logger.info("Migrations should be run via Supabase CLI or dashboard")
        logger.info(f"Migration SQL: {migration_sql[:200]}...")
        return False  # Indicate manual execution needed
    except Exception as e:
        logger.error(f"Error executing migration: {str(e)}")
        return False


async def create_requirement(
    project_id: str,
    source: str,
    title: str,
    description: Optional[str] = None,
    source_ref: Optional[str] = None,
    raw_payload: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """Create a requirement record and auto-generate embedding"""
    try:
        client = get_database_client()
        if not client:
            return None
        
        # Prepare requirement text for embedding
        requirement_text = f"{title}\n{description or ''}".strip()
        
        # Generate body_clean and checksum for RAG
        from app.services.embedding_service import embedding_service
        body_clean = embedding_service.normalize_text_for_embedding(requirement_text) if requirement_text else None
        checksum = embedding_service.generate_checksum(requirement_text) if requirement_text else None
        
        # Get organization_id from project_id
        organization_id = None
        if POSTGRES_DIRECT_AVAILABLE and hasattr(client, 'getconn'):
            from app.services.postgres_direct import execute_query
            project_query = await execute_query(
                "SELECT org_id FROM projects WHERE id = %s",
                (project_id,)
            )
            if project_query and len(project_query) > 0:
                organization_id = project_query[0].get("org_id")
        
        # Try direct Postgres first
        if POSTGRES_DIRECT_AVAILABLE and hasattr(client, 'getconn'):
            from app.services.postgres_direct import execute_insert
            data = {
                "project_id": project_id,
                "source": source,
                "title": title,
                "description": description,
                "source_ref": source_ref,
                "raw_payload": raw_payload,
                "body_clean": body_clean,
                "checksum": checksum
            }
            requirement_id = await execute_insert("requirements", data)
            
            # Auto-generate embedding asynchronously (fire-and-forget)
            if requirement_id and organization_id and requirement_text:
                import asyncio
                asyncio.create_task(_generate_and_store_embedding(
                    requirement_id=requirement_id,
                    organization_id=organization_id,
                    project_id=project_id,
                    requirement_text=requirement_text
                ))
            
            return requirement_id
        
        # Fallback to Supabase
        data = {
            "project_id": project_id,
            "source": source,
            "title": title,
            "description": description,
            "source_ref": source_ref,
            "raw_payload": raw_payload,
            "body_clean": body_clean,
            "checksum": checksum
        }
        
        result = client.table("requirements").insert(data).execute()
        if result.data:
            requirement_id = result.data[0].get("id")
            
            # Try to get org_id from project (Supabase)
            try:
                project_result = client.table("projects").select("org_id").eq("id", project_id).execute()
                if project_result.data and len(project_result.data) > 0:
                    organization_id = project_result.data[0].get("org_id")
                    
                    # Auto-generate embedding asynchronously
                    if requirement_id and organization_id and requirement_text:
                        import asyncio
                        asyncio.create_task(_generate_and_store_embedding(
                            requirement_id=requirement_id,
                            organization_id=organization_id,
                            project_id=project_id,
                            requirement_text=requirement_text
                        ))
            except Exception as e:
                logger.warning(f"Could not get org_id for embedding generation: {e}")
            
            return requirement_id
        return None
    except Exception as e:
        logger.error(f"Error creating requirement: {str(e)}")
        return None


async def _generate_and_store_embedding(
    requirement_id: str,
    organization_id: str,
    project_id: str,
    requirement_text: str
):
    """
    Background task to generate and store embedding for a requirement
    This runs asynchronously and doesn't block requirement creation
    """
    try:
        from app.services.embedding_service import embedding_service
        import asyncpg
        import os
        
        # Initialize embedding service
        await embedding_service.initialize()
        
        # Generate embedding
        embedding = await embedding_service.generate_embedding(requirement_text)
        embedding_model = embedding_service.embedding_model
        
        # Store in requirement_embeddings table
        # Use same connection string logic as postgres_direct
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            # Build from individual components (same as postgres_direct)
            host = os.getenv("POSTGRES_HOST", "localhost")
            port = os.getenv("POSTGRES_PORT", "5432")
            database = os.getenv("POSTGRES_DB", "qaai")
            user = os.getenv("POSTGRES_USER", "qaai")
            password = os.getenv("POSTGRES_PASSWORD", "qaai123")
            database_url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        
        conn = await asyncpg.connect(database_url)
        try:
            # Convert numpy array to PostgreSQL vector format
            embedding_str = '[' + ','.join(map(str, embedding.tolist())) + ']'
            
            # Insert or update embedding
            await conn.execute("""
                INSERT INTO requirement_embeddings 
                    (requirement_id, organization_id, project_id, embedding, embedding_model)
                VALUES ($1::uuid, $2::uuid, $3::uuid, $4::vector, $5)
                ON CONFLICT (requirement_id) 
                DO UPDATE SET 
                    embedding = $4::vector,
                    embedding_model = $5,
                    updated_at = NOW()
            """, requirement_id, organization_id, project_id, embedding_str, embedding_model)
            
            logger.info(f"Successfully stored embedding for requirement {requirement_id}")
        finally:
            await conn.close()
            await embedding_service.cleanup()
            
    except Exception as e:
        logger.error(f"Error generating/storing embedding for requirement {requirement_id}: {e}")
        # Don't raise - this is a background task


async def get_requirement(requirement_id: str) -> Optional[Dict[str, Any]]:
    """Get a requirement by ID"""
    try:
        client = get_database_client()
        if not client:
            return None
        
        result = client.table("requirements").select("*").eq("id", requirement_id).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        logger.error(f"Error getting requirement: {str(e)}")
        return None

