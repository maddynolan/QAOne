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
    from app.services.storage.database import get_database_client
    
    def get_supabase_client() -> Optional[Client]:
        """Get database client (Supabase or direct Postgres)"""
        client = get_database_client()
        # Return only if it's a Supabase client
        if client and hasattr(client, 'table'):
            return client
        return None
except ImportError:
    def get_supabase_client():
        from app.services.storage.database import get_database_client
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
    org_id: Optional[str] = None,
    task_category: Optional[str] = None
) -> Optional[str]:
    """
    Store AI generation in database for fine-tuning
    
    Returns:
        Generation ID if stored successfully, None otherwise
    """
    try:
        from app.services.storage.database import get_database_client
        from app.services.storage.postgres_direct import execute_insert
        
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
            
            # Determine task category from endpoint
            if not task_category and endpoint:
                if "jira-to-testcases" in endpoint or "generate-tests" in endpoint:
                    task_category = "manual"
                elif "testcase-to-playwright" in endpoint or "convert-to-playwright" in endpoint:
                    task_category = "automation"
                elif "api" in endpoint.lower():
                    task_category = "api"
                elif "triage" in endpoint.lower():
                    task_category = "triage"
                elif "performance" in endpoint.lower() or "perf" in endpoint.lower():
                    task_category = "performance"
                elif "security" in endpoint.lower():
                    task_category = "security"
                elif "accessibility" in endpoint.lower() or "a11y" in endpoint.lower():
                    task_category = "accessibility"
            
            # Determine complexity level from prompt length and content
            complexity_level = None
            if prompt:
                prompt_length = len(prompt)
                if prompt_length < 200:
                    complexity_level = "simple"
                elif prompt_length < 500:
                    complexity_level = "medium"
                else:
                    complexity_level = "complex"
                
                # Adjust based on keywords
                complex_keywords = ["multiple", "integration", "performance", "security", "edge case", "scenario"]
                if any(keyword in prompt.lower() for keyword in complex_keywords):
                    if complexity_level == "simple":
                        complexity_level = "medium"
                    elif complexity_level == "medium":
                        complexity_level = "complex"
            
            # Extract tags from output if it's JSON
            tags = []
            if output_jsonb and isinstance(output_jsonb, dict):
                # Try to extract tags from generated test cases
                if "tags" in output_jsonb:
                    tags = output_jsonb["tags"] if isinstance(output_jsonb["tags"], list) else []
                elif isinstance(output_jsonb, list) and len(output_jsonb) > 0:
                    # If it's a list of test cases, get tags from first one
                    first_item = output_jsonb[0] if isinstance(output_jsonb[0], dict) else {}
                    if "tags" in first_item:
                        tags = first_item["tags"] if isinstance(first_item["tags"], list) else []
            
            # Add default tags based on task_category
            if task_category and not tags:
                tags = [task_category]
            
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
                "task_category": task_category,
                "complexity_level": complexity_level,
                "tags": tags if tags else None,
                "latency_ms": latency_ms
            }
            
            # Try direct Postgres first
            if hasattr(client, 'getconn'):
                # Direct Postgres connection
                generation_id = await execute_insert("ai_generations", data)
                return generation_id
            elif hasattr(client, 'table'):
                # Supabase client
                result = client.table("ai_generations").insert(data).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0].get("id")
                return None
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
            
            # Return a placeholder ID for file logging
            return f"log_{datetime.utcnow().timestamp()}"
    except Exception as e:
        print(f"Error storing AI generation: {str(e)}")
        # Don't fail the request if storage fails
        return None

