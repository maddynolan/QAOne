"""
Test Case Version Control Service

Provides version history, diff tracking, branching, and revert for no-code test cases.
Every test case save creates a new version with full JSONB snapshot + computed diff.

Usage:
    from app.services.core.version_control_service import version_service

    # Auto-creates version on save
    await version_service.create_version(test_case_id, snapshot, changed_by, change_type="modified")

    # Get version history
    versions = await version_service.get_versions(test_case_id)

    # Compare two versions
    diff = await version_service.compare_versions(version_id_1, version_id_2)

    # Revert to a previous version
    await version_service.revert_to_version(test_case_id, version_id)
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from collections import deque

logger = logging.getLogger(__name__)

# In-memory fallback storage
_versions_store: Dict[str, List[Dict[str, Any]]] = {}  # test_case_id -> [versions]


def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available"""
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


def _compute_diff(old_snapshot: Dict[str, Any], new_snapshot: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """
    Compute a human-readable diff summary and structured diff between two test case snapshots.

    Returns:
        (diff_summary: str, diff_details: dict)
    """
    changes = []
    diff_details = {"added": [], "removed": [], "modified": []}

    # Compare top-level fields
    simple_fields = ["title", "description", "priority", "test_type", "status", "preconditions", "estimated_time"]
    for field in simple_fields:
        old_val = old_snapshot.get(field)
        new_val = new_snapshot.get(field)
        if old_val != new_val:
            changes.append(f"Changed {field}: '{old_val}' → '{new_val}'")
            diff_details["modified"].append({
                "field": field,
                "old": old_val,
                "new": new_val
            })

    # Compare tags
    old_tags = set(old_snapshot.get("tags") or [])
    new_tags = set(new_snapshot.get("tags") or [])
    added_tags = new_tags - old_tags
    removed_tags = old_tags - new_tags
    if added_tags:
        changes.append(f"Added tags: {', '.join(added_tags)}")
        diff_details["added"].append({"field": "tags", "values": list(added_tags)})
    if removed_tags:
        changes.append(f"Removed tags: {', '.join(removed_tags)}")
        diff_details["removed"].append({"field": "tags", "values": list(removed_tags)})

    # Compare steps (the most important part for no-code test versioning)
    old_steps = old_snapshot.get("steps") or []
    new_steps = new_snapshot.get("steps") or []

    if len(old_steps) != len(new_steps):
        if len(new_steps) > len(old_steps):
            added_count = len(new_steps) - len(old_steps)
            changes.append(f"Added {added_count} step(s) (now {len(new_steps)} total)")
            diff_details["added"].append({"field": "steps", "count": added_count, "new_total": len(new_steps)})
        else:
            removed_count = len(old_steps) - len(new_steps)
            changes.append(f"Removed {removed_count} step(s) (now {len(new_steps)} total)")
            diff_details["removed"].append({"field": "steps", "count": removed_count, "new_total": len(new_steps)})

    # Compare individual steps content
    min_len = min(len(old_steps), len(new_steps))
    modified_step_indices = []
    for i in range(min_len):
        if json.dumps(old_steps[i], sort_keys=True) != json.dumps(new_steps[i], sort_keys=True):
            modified_step_indices.append(i + 1)  # 1-indexed for human readability

    if modified_step_indices:
        step_nums = ", ".join(str(s) for s in modified_step_indices[:5])
        suffix = f" (+{len(modified_step_indices) - 5} more)" if len(modified_step_indices) > 5 else ""
        changes.append(f"Modified step(s): {step_nums}{suffix}")
        diff_details["modified"].append({
            "field": "steps",
            "modified_indices": modified_step_indices,
            "details": [
                {
                    "step": idx,
                    "old": old_steps[idx - 1] if idx - 1 < len(old_steps) else None,
                    "new": new_steps[idx - 1] if idx - 1 < len(new_steps) else None
                }
                for idx in modified_step_indices[:10]  # Limit to first 10 for storage
            ]
        })

    # Compare test data
    old_data = json.dumps(old_snapshot.get("test_data") or {}, sort_keys=True)
    new_data = json.dumps(new_snapshot.get("test_data") or {}, sort_keys=True)
    if old_data != new_data:
        changes.append("Updated test data")
        diff_details["modified"].append({"field": "test_data"})

    diff_summary = "; ".join(changes) if changes else "No changes detected"
    return diff_summary, diff_details


class VersionControlService:
    """Manages test case version history with PostgreSQL + in-memory fallback."""

    async def create_version(
        self,
        test_case_id: str,
        snapshot: Dict[str, Any],
        changed_by: str = None,
        change_type: str = "modified",
        metadata: Dict[str, Any] = None,
        parent_version_id: str = None
    ) -> Optional[str]:
        """
        Create a new version snapshot for a test case.
        Auto-increments version number and computes diff from previous version.

        Returns: version_id or None
        """
        try:
            changed_by = changed_by or "system"
            metadata = metadata or {}

            if _is_postgres_available():
                return await self._create_version_pg(
                    test_case_id, snapshot, changed_by, change_type, metadata, parent_version_id
                )
            else:
                return self._create_version_memory(
                    test_case_id, snapshot, changed_by, change_type, metadata, parent_version_id
                )
        except Exception as e:
            logger.error(f"Error creating version for test case {test_case_id}: {e}")
            return None

    async def _create_version_pg(
        self, test_case_id, snapshot, changed_by, change_type, metadata, parent_version_id
    ) -> Optional[str]:
        """Create version in PostgreSQL."""
        from app.services.storage.postgres_direct import execute_query, get_postgres_pool

        pool = get_postgres_pool()
        if not pool:
            return self._create_version_memory(
                test_case_id, snapshot, changed_by, change_type, metadata, parent_version_id
            )

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Get current max version
                cur.execute(
                    "SELECT COALESCE(MAX(version), 0) FROM test_case_versions WHERE test_case_id = %s",
                    (test_case_id,)
                )
                max_version = cur.fetchone()[0]
                new_version = max_version + 1

                # Get previous snapshot for diff computation
                diff_summary = "Initial version"
                diff_details = {}

                if max_version > 0:
                    cur.execute(
                        "SELECT snapshot FROM test_case_versions WHERE test_case_id = %s AND version = %s",
                        (test_case_id, max_version)
                    )
                    prev_row = cur.fetchone()
                    if prev_row:
                        prev_snapshot = prev_row[0] if isinstance(prev_row[0], dict) else json.loads(prev_row[0])
                        diff_summary, diff_details = _compute_diff(prev_snapshot, snapshot)

                # Insert new version
                version_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO test_case_versions
                        (id, test_case_id, version, change_type, changed_by, snapshot,
                         diff_summary, diff_details, parent_version_id, metadata)
                    VALUES (%s, %s::uuid, %s, %s, %s, %s::jsonb, %s, %s::jsonb, %s, %s::jsonb)
                    RETURNING id
                    """,
                    (
                        version_id,
                        test_case_id,
                        new_version,
                        change_type,
                        changed_by,
                        json.dumps(snapshot),
                        diff_summary,
                        json.dumps(diff_details),
                        parent_version_id,
                        json.dumps(metadata)
                    )
                )
                result = cur.fetchone()
                conn.commit()

                logger.info(f"Created version {new_version} for test case {test_case_id}: {diff_summary}")
                return str(result[0]) if result else version_id
        except Exception as e:
            conn.rollback()
            logger.error(f"PostgreSQL version creation failed: {e}")
            return self._create_version_memory(
                test_case_id, snapshot, changed_by, change_type, metadata, parent_version_id
            )
        finally:
            pool.putconn(conn)

    def _create_version_memory(
        self, test_case_id, snapshot, changed_by, change_type, metadata, parent_version_id
    ) -> str:
        """Create version in in-memory store."""
        if test_case_id not in _versions_store:
            _versions_store[test_case_id] = []

        versions = _versions_store[test_case_id]
        new_version = len(versions) + 1

        # Compute diff from previous
        diff_summary = "Initial version"
        diff_details = {}
        if versions:
            prev = versions[-1]
            diff_summary, diff_details = _compute_diff(prev["snapshot"], snapshot)

        version_id = str(uuid.uuid4())
        version_entry = {
            "id": version_id,
            "test_case_id": test_case_id,
            "version": new_version,
            "change_type": change_type,
            "changed_by": changed_by,
            "snapshot": snapshot,
            "diff_summary": diff_summary,
            "diff_details": diff_details,
            "parent_version_id": parent_version_id,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat()
        }
        versions.append(version_entry)

        logger.info(f"Created in-memory version {new_version} for test case {test_case_id}")
        return version_id

    async def get_versions(
        self,
        test_case_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get version history for a test case (newest first)."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query

                results = await execute_query(
                    """
                    SELECT id, test_case_id, version, change_type, changed_by,
                           diff_summary, diff_details, parent_version_id, metadata, created_at
                    FROM test_case_versions
                    WHERE test_case_id = %s
                    ORDER BY version DESC
                    LIMIT %s OFFSET %s
                    """,
                    (test_case_id, limit, offset)
                )

                versions = []
                for row in results or []:
                    versions.append({
                        "id": str(row.get("id", "")),
                        "test_case_id": str(row.get("test_case_id", "")),
                        "version": row.get("version"),
                        "change_type": row.get("change_type"),
                        "changed_by": str(row.get("changed_by", "")),
                        "diff_summary": row.get("diff_summary"),
                        "diff_details": row.get("diff_details") or {},
                        "parent_version_id": str(row.get("parent_version_id", "")) if row.get("parent_version_id") else None,
                        "metadata": row.get("metadata") or {},
                        "created_at": row.get("created_at").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", ""))
                    })
                return versions
            else:
                # In-memory fallback
                versions = _versions_store.get(test_case_id, [])
                # Return newest first, with pagination
                sorted_versions = sorted(versions, key=lambda v: v["version"], reverse=True)
                return sorted_versions[offset:offset + limit]
        except Exception as e:
            logger.error(f"Error getting versions for {test_case_id}: {e}")
            return []

    async def get_version_snapshot(self, version_id: str) -> Optional[Dict[str, Any]]:
        """Get the full snapshot for a specific version."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query

                results = await execute_query(
                    "SELECT snapshot, version, test_case_id, change_type, changed_by, created_at FROM test_case_versions WHERE id = %s",
                    (version_id,)
                )

                if results and len(results) > 0:
                    row = results[0]
                    snapshot = row.get("snapshot")
                    if isinstance(snapshot, str):
                        snapshot = json.loads(snapshot)
                    return {
                        "id": version_id,
                        "test_case_id": str(row.get("test_case_id", "")),
                        "version": row.get("version"),
                        "change_type": row.get("change_type"),
                        "changed_by": str(row.get("changed_by", "")),
                        "snapshot": snapshot,
                        "created_at": row.get("created_at").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", ""))
                    }
            else:
                # Search in-memory
                for tc_versions in _versions_store.values():
                    for v in tc_versions:
                        if v["id"] == version_id:
                            return v
            return None
        except Exception as e:
            logger.error(f"Error getting version snapshot {version_id}: {e}")
            return None

    async def compare_versions(
        self,
        version_id_a: str,
        version_id_b: str
    ) -> Optional[Dict[str, Any]]:
        """Compare two version snapshots and return the diff."""
        try:
            version_a = await self.get_version_snapshot(version_id_a)
            version_b = await self.get_version_snapshot(version_id_b)

            if not version_a or not version_b:
                return None

            diff_summary, diff_details = _compute_diff(
                version_a["snapshot"],
                version_b["snapshot"]
            )

            return {
                "version_a": {"id": version_id_a, "version": version_a["version"]},
                "version_b": {"id": version_id_b, "version": version_b["version"]},
                "diff_summary": diff_summary,
                "diff_details": diff_details,
                "snapshot_a": version_a["snapshot"],
                "snapshot_b": version_b["snapshot"]
            }
        except Exception as e:
            logger.error(f"Error comparing versions: {e}")
            return None

    async def get_version_count(self, test_case_id: str) -> int:
        """Get total number of versions for a test case."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query
                results = await execute_query(
                    "SELECT COUNT(*) as count FROM test_case_versions WHERE test_case_id = %s",
                    (test_case_id,)
                )
                if results:
                    return results[0].get("count", 0)
            else:
                return len(_versions_store.get(test_case_id, []))
        except Exception:
            return 0

    async def revert_to_version(self, test_case_id: str, version_id: str, reverted_by: str = None) -> Optional[Dict[str, Any]]:
        """
        Revert a test case to a previous version.
        Creates a NEW version (doesn't delete history) with change_type='restored'.
        Returns the restored snapshot.
        """
        try:
            # Get the target version snapshot
            target = await self.get_version_snapshot(version_id)
            if not target:
                logger.error(f"Version {version_id} not found for revert")
                return None

            snapshot = target["snapshot"]

            # Create a new version entry of type 'restored'
            new_version_id = await self.create_version(
                test_case_id=test_case_id,
                snapshot=snapshot,
                changed_by=reverted_by or "system",
                change_type="restored",
                metadata={"restored_from_version": target["version"], "restored_from_id": version_id}
            )

            logger.info(f"Reverted test case {test_case_id} to version {target['version']}, created new version {new_version_id}")

            return {
                "new_version_id": new_version_id,
                "restored_from_version": target["version"],
                "snapshot": snapshot
            }
        except Exception as e:
            logger.error(f"Error reverting test case {test_case_id} to version {version_id}: {e}")
            return None


# Singleton instance
version_service = VersionControlService()
