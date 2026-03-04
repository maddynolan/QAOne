"""
Test Environment Service
========================
CRUD operations for project-level test environments and URL resolution logic.
Environments define base URLs and variables so the same test case can run
against QA, Staging, or Preprod without duplication.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# In-memory fallback when PostgreSQL is unavailable
_memory_environments: Dict[str, Dict[str, Any]] = {}


def _get_db():
    """Get database client (returns None if unavailable)."""
    try:
        from app.services.storage.database import get_client
        return get_client()
    except Exception:
        return None


# ============================================================================
# CRUD Operations
# ============================================================================

async def get_environments(project_id: str) -> List[Dict[str, Any]]:
    """List all environments for a project."""
    db = _get_db()
    if db:
        try:
            result = db.table("test_environments") \
                .select("*") \
                .eq("project_id", project_id) \
                .order("created_at") \
                .execute()
            return result.data or []
        except Exception as e:
            logger.warning(f"DB read failed, using memory fallback: {e}")

    # Memory fallback
    return [
        env for env in _memory_environments.values()
        if env.get("project_id") == project_id
    ]


async def get_environment(env_id: str) -> Optional[Dict[str, Any]]:
    """Get a single environment by ID."""
    db = _get_db()
    if db:
        try:
            result = db.table("test_environments") \
                .select("*") \
                .eq("id", env_id) \
                .single() \
                .execute()
            return result.data
        except Exception as e:
            logger.warning(f"DB read failed, using memory fallback: {e}")

    return _memory_environments.get(env_id)


async def create_environment(data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new environment."""
    env_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    env = {
        "id": env_id,
        "project_id": data["project_id"],
        "name": data["name"],
        "base_url": data["base_url"].rstrip("/"),
        "variables": data.get("variables", []),
        "is_default": data.get("is_default", False),
        "created_at": now,
        "updated_at": now,
    }

    # If setting as default, unset others first
    if env["is_default"]:
        await _clear_default(data["project_id"])

    db = _get_db()
    if db:
        try:
            result = db.table("test_environments").insert(env).execute()
            return result.data[0] if result.data else env
        except Exception as e:
            logger.warning(f"DB insert failed, using memory fallback: {e}")

    _memory_environments[env_id] = env
    return env


async def update_environment(env_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update an existing environment."""
    updates = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if "name" in data:
        updates["name"] = data["name"]
    if "base_url" in data:
        updates["base_url"] = data["base_url"].rstrip("/")
    if "variables" in data:
        updates["variables"] = data["variables"]
    if "is_default" in data:
        updates["is_default"] = data["is_default"]

    # If setting as default, unset others first
    if updates.get("is_default"):
        existing = await get_environment(env_id)
        if existing:
            await _clear_default(existing["project_id"])

    db = _get_db()
    if db:
        try:
            result = db.table("test_environments") \
                .update(updates) \
                .eq("id", env_id) \
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.warning(f"DB update failed, using memory fallback: {e}")

    if env_id in _memory_environments:
        _memory_environments[env_id].update(updates)
        return _memory_environments[env_id]
    return None


async def delete_environment(env_id: str) -> bool:
    """Delete an environment."""
    db = _get_db()
    if db:
        try:
            db.table("test_environments").delete().eq("id", env_id).execute()
            return True
        except Exception as e:
            logger.warning(f"DB delete failed, using memory fallback: {e}")

    if env_id in _memory_environments:
        del _memory_environments[env_id]
        return True
    return False


async def set_default(env_id: str) -> Optional[Dict[str, Any]]:
    """Set an environment as the project default (unsets others)."""
    env = await get_environment(env_id)
    if not env:
        return None

    await _clear_default(env["project_id"])
    return await update_environment(env_id, {"is_default": True})


async def _clear_default(project_id: str):
    """Unset default flag for all environments in a project."""
    db = _get_db()
    if db:
        try:
            db.table("test_environments") \
                .update({"is_default": False}) \
                .eq("project_id", project_id) \
                .eq("is_default", True) \
                .execute()
            return
        except Exception:
            pass

    for env in _memory_environments.values():
        if env.get("project_id") == project_id:
            env["is_default"] = False


# ============================================================================
# URL Resolution Logic
# ============================================================================

def resolve_url(original_url: str, test_base_url: str, env_base_url: str) -> str:
    """
    Rewrite a URL by swapping the base domain.

    If original_url starts with test_base_url, replace that prefix with env_base_url.
    External URLs (not matching test_base_url) are left unchanged.

    Examples:
      resolve_url("https://qa.example.com/login", "https://qa.example.com", "https://staging.example.com")
        => "https://staging.example.com/login"

      resolve_url("https://external-sso.com/auth", "https://qa.example.com", "https://staging.example.com")
        => "https://external-sso.com/auth"  (unchanged)
    """
    if not original_url or not test_base_url or not env_base_url:
        return original_url

    # Normalize: strip trailing slashes
    test_base = test_base_url.rstrip("/")
    env_base = env_base_url.rstrip("/")

    if not test_base:
        return original_url

    # Check if original URL starts with the test base URL
    if original_url.startswith(test_base):
        # Swap the base
        path = original_url[len(test_base):]
        return env_base + path

    # Also try protocol-agnostic match (http vs https)
    test_parsed = urlparse(test_base)
    orig_parsed = urlparse(original_url)

    if (test_parsed.netloc == orig_parsed.netloc and
        test_parsed.path.rstrip("/") == orig_parsed.path[:len(test_parsed.path)].rstrip("/")):
        # Same host, swap protocol+host
        return env_base + orig_parsed.path[len(test_parsed.path):] + \
               (f"?{orig_parsed.query}" if orig_parsed.query else "") + \
               (f"#{orig_parsed.fragment}" if orig_parsed.fragment else "")

    return original_url


def resolve_step_variables(step_data: Dict[str, Any], variables: Dict[str, str]) -> Dict[str, Any]:
    """
    Replace {{variable_name}} placeholders in step string fields with values
    from the environment variables dict.
    """
    if not variables:
        return step_data

    resolved = {}
    for key, val in step_data.items():
        if isinstance(val, str):
            for var_name, var_value in variables.items():
                val = val.replace(f"{{{{{var_name}}}}}", var_value)
            resolved[key] = val
        else:
            resolved[key] = val

    return resolved
