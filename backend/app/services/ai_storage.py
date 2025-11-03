"""
Service to store AI generations in database for fine-tuning
"""

import os
import json
from typing import Dict, Any, Optional
from datetime import datetime

# For now, we'll use a simple file-based storage or Supabase if available
# This can be replaced with actual database connection later

try:
    from supabase import create_client, Client
    from app.services.database import get_database_client
    
    def get_supabase_client() -> Optional[Client]:
        """Get database client (Supabase or direct Postgres)"""
        client = get_database_client()
        # Return only if it's a Supabase client
        if client and hasattr(client, 'table'):
            return client
        return None
except ImportError:
    def get_supabase_client():
        from app.services.database import get_database_client
        client = get_database_client()
        if client and hasattr(client, 'table'):
            return client
        return None


async def store_ai_generation(
    project_id: str,
    prompt: str,
    model: str,
    output: str,
    mode: Optional[str] = None,
    endpoint: Optional[str] = None,
    latency_ms: Optional[int] = None,
    org_id: Optional[str] = None
) -> bool:
    """
    Store AI generation in database for fine-tuning
    
    Returns:
        True if stored successfully, False otherwise
    """
    try:
        from app.services.database import get_database_client
        from app.services.postgres_direct import execute_insert
        
        client = get_database_client()
        
        if client:
            # Try to parse output as JSON for JSONB storage
            output_jsonb = None
            try:
                if isinstance(output, str):
                    output_jsonb = json.loads(output)
                else:
                    output_jsonb = output
            except (json.JSONDecodeError, TypeError):
                # Keep as text if not valid JSON
                pass
            
            data = {
                "project_id": project_id,
                "org_id": org_id,
                "prompt": prompt,
                "model": model,
                "output": output,  # Keep as text for compatibility
                "output_jsonb": output_jsonb,  # Add JSONB version if valid
                "mode": mode,
                "endpoint": endpoint,
                "task": endpoint.replace("/ai/", "").replace("-", "_") if endpoint else None,  # e.g., "jira_to_testcases"
                "latency_ms": latency_ms
            }
            
            # Try direct Postgres first
            if hasattr(client, 'getconn'):
                # Direct Postgres connection
                await execute_insert("ai_generations", data)
                return True
            elif hasattr(client, 'table'):
                # Supabase client
                result = client.table("ai_generations").insert(data).execute()
                return True
        else:
            # Fallback: Log to file for later import
            log_file = os.getenv("AI_GENERATIONS_LOG", "ai_generations.jsonl")
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "project_id": project_id,
                "org_id": org_id,
                "prompt": prompt,
                "model": model,
                "output": output,
                "mode": mode,
                "endpoint": endpoint,
                "latency_ms": latency_ms
            }
            
            with open(log_file, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
            
            return True
    except Exception as e:
        print(f"Error storing AI generation: {str(e)}")
        # Don't fail the request if storage fails
        return False

