"""
Universal Version Control Service — Version history + branching for ALL artifact types

Generalizes the test case version control to support any artifact type:
test_case, api_collection, perf_scenario, mobile_flow, visual_baseline,
a11y_config, test_plan, defect, requirement, test_suite.

Features:
- Create version snapshots on every save
- Diff computation between versions
- Branch creation and merge
- Non-destructive revert (creates new version)
- Full version history with pagination

Usage:
    from app.services.core.universal_version_service import universal_version_service

    # Create a version snapshot
    await universal_version_service.create_version(
        artifact_type="api_collection",
        artifact_id=collection_id,
        snapshot=collection_data,
        changed_by=user_id,
        project_id=project_id
    )

    # List versions
    versions = await universal_version_service.list_versions("api_collection", id)

    # Create a branch
    await universal_version_service.create_branch("test_case", id, "experiment-v2", from_version_id)

    # Merge branch
    await universal_version_service.merge_branch("test_case", id, "experiment-v2", "main")
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

logger = logging.getLogger(__name__)


class UniversalVersionService:
    """
    Universal version control for all artifact types.
    PostgreSQL primary with in-memory fallback.
    """

    def __init__(self):
        self._pool = None
        # In-memory fallback: {(type, id, branch): [version_dicts]}
        self._memory_versions: Dict[tuple, List[Dict]] = {}
        self._memory_branches: Dict[tuple, List[Dict]] = {}

    def _get_pool(self):
        if self._pool:
            return self._pool
        try:
            from app.services.storage.database import get_database_client
            self._pool = get_database_client()
            return self._pool
        except Exception:
            return None

    # ==================== Create Version ====================

    async def create_version(
        self,
        artifact_type: str,
        artifact_id: str,
        snapshot: Dict[str, Any],
        changed_by: Optional[str] = None,
        changed_by_name: str = "",
        project_id: Optional[str] = None,
        org_id: Optional[str] = None,
        branch: str = "main",
        change_type: str = "modified",
        diff_summary: str = "",
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new version snapshot for an artifact.
        Auto-increments version number within the branch.
        Computes diff against previous version if available.
        """
        pool = self._get_pool()
        if pool:
            return await self._create_version_pg(
                pool, artifact_type, artifact_id, snapshot, changed_by,
                changed_by_name, project_id, org_id, branch, change_type, diff_summary
            )
        else:
            return self._create_version_memory(
                artifact_type, artifact_id, snapshot, changed_by,
                changed_by_name, project_id, org_id, branch, change_type, diff_summary
            )

    async def _create_version_pg(
        self, pool, artifact_type, artifact_id, snapshot, changed_by,
        changed_by_name, project_id, org_id, branch, change_type, diff_summary
    ):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Get next version number
                cur.execute(
                    """SELECT COALESCE(MAX(version), 0) + 1
                       FROM artifact_versions
                       WHERE artifact_type = %s AND artifact_id = %s AND branch_name = %s""",
                    (artifact_type, artifact_id, branch),
                )
                next_version = cur.fetchone()[0]

                # Get parent version for diff
                parent_version_id = None
                diff_details = None
                if next_version > 1:
                    cur.execute(
                        """SELECT id, snapshot FROM artifact_versions
                           WHERE artifact_type = %s AND artifact_id = %s AND branch_name = %s
                           ORDER BY version DESC LIMIT 1""",
                        (artifact_type, artifact_id, branch),
                    )
                    prev = cur.fetchone()
                    if prev:
                        parent_version_id = prev[0]
                        prev_snapshot = prev[1] if isinstance(prev[1], dict) else json.loads(prev[1])
                        diff_details = self._compute_diff(prev_snapshot, snapshot)
                        if not diff_summary:
                            diff_summary = self._summarize_diff(diff_details)

                # If first version, set change_type to 'created'
                if next_version == 1 and change_type == "modified":
                    change_type = "created"

                version_id = str(uuid4())
                cur.execute(
                    """INSERT INTO artifact_versions
                       (id, artifact_type, artifact_id, version, change_type,
                        changed_by, changed_by_name, snapshot, diff_summary, diff_details,
                        parent_version_id, branch_name, project_id, org_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (version_id, artifact_type, artifact_id, next_version, change_type,
                     changed_by, changed_by_name,
                     json.dumps(snapshot) if not isinstance(snapshot, str) else snapshot,
                     diff_summary,
                     json.dumps(diff_details) if diff_details else None,
                     parent_version_id, branch, project_id, org_id),
                )
                conn.commit()

                return {
                    "id": version_id,
                    "artifact_type": artifact_type,
                    "artifact_id": str(artifact_id),
                    "version": next_version,
                    "change_type": change_type,
                    "branch_name": branch,
                    "diff_summary": diff_summary,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
        except Exception as e:
            conn.rollback()
            logger.error(f"Create version error: {e}")
            return self._create_version_memory(
                artifact_type, artifact_id, snapshot, changed_by,
                changed_by_name, project_id, org_id, branch, change_type, diff_summary
            )
        finally:
            pool.putconn(conn)

    def _create_version_memory(
        self, artifact_type, artifact_id, snapshot, changed_by,
        changed_by_name, project_id, org_id, branch, change_type, diff_summary
    ):
        key = (artifact_type, str(artifact_id), branch)
        if key not in self._memory_versions:
            self._memory_versions[key] = []

        versions = self._memory_versions[key]
        next_version = len(versions) + 1
        if next_version == 1 and change_type == "modified":
            change_type = "created"

        version = {
            "id": str(uuid4()),
            "artifact_type": artifact_type,
            "artifact_id": str(artifact_id),
            "version": next_version,
            "change_type": change_type,
            "changed_by": changed_by,
            "changed_by_name": changed_by_name,
            "snapshot": snapshot,
            "diff_summary": diff_summary,
            "branch_name": branch,
            "project_id": project_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        versions.append(version)
        return version

    # ==================== List Versions ====================

    async def list_versions(
        self,
        artifact_type: str,
        artifact_id: str,
        branch: str = "main",
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List versions for an artifact (newest first)."""
        pool = self._get_pool()
        if pool:
            return await self._list_versions_pg(pool, artifact_type, artifact_id, branch, limit, offset)
        else:
            key = (artifact_type, str(artifact_id), branch)
            versions = self._memory_versions.get(key, [])
            # Remove snapshots from list view for performance
            return [
                {k: v for k, v in ver.items() if k != "snapshot"}
                for ver in reversed(versions[offset:offset + limit])
            ]

    async def _list_versions_pg(self, pool, artifact_type, artifact_id, branch, limit, offset):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, version, change_type, changed_by, changed_by_name,
                              diff_summary, branch_name, created_at
                       FROM artifact_versions
                       WHERE artifact_type = %s AND artifact_id = %s AND branch_name = %s
                       ORDER BY version DESC
                       LIMIT %s OFFSET %s""",
                    (artifact_type, artifact_id, branch, limit, offset),
                )
                rows = cur.fetchall()
                return [
                    {
                        "id": str(r[0]),
                        "version": r[1],
                        "change_type": r[2],
                        "changed_by": str(r[3]) if r[3] else None,
                        "changed_by_name": r[4] or "",
                        "diff_summary": r[5] or "",
                        "branch_name": r[6],
                        "created_at": r[7].isoformat() if r[7] else None,
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"List versions error: {e}")
            return []
        finally:
            pool.putconn(conn)

    # ==================== Get Version Snapshot ====================

    async def get_version(
        self,
        artifact_type: str,
        artifact_id: str,
        version_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get full version with JSONB snapshot."""
        pool = self._get_pool()
        if pool:
            return await self._get_version_pg(pool, artifact_type, artifact_id, version_id)
        else:
            for key, versions in self._memory_versions.items():
                for v in versions:
                    if v["id"] == version_id:
                        return v
            return None

    async def _get_version_pg(self, pool, artifact_type, artifact_id, version_id):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, version, change_type, changed_by, changed_by_name,
                              snapshot, diff_summary, diff_details, branch_name, created_at
                       FROM artifact_versions WHERE id = %s""",
                    (version_id,),
                )
                r = cur.fetchone()
                if not r:
                    return None
                return {
                    "id": str(r[0]),
                    "version": r[1],
                    "change_type": r[2],
                    "changed_by": str(r[3]) if r[3] else None,
                    "changed_by_name": r[4] or "",
                    "snapshot": r[5],
                    "diff_summary": r[6] or "",
                    "diff_details": r[7],
                    "branch_name": r[8],
                    "created_at": r[9].isoformat() if r[9] else None,
                }
        except Exception as e:
            logger.error(f"Get version error: {e}")
            return None
        finally:
            pool.putconn(conn)

    # ==================== Compare Versions ====================

    async def compare_versions(
        self,
        version_id_a: str,
        version_id_b: str,
    ) -> Optional[Dict[str, Any]]:
        """Compare two versions and return diff."""
        va = await self.get_version("", "", version_id_a)
        vb = await self.get_version("", "", version_id_b)
        if not va or not vb:
            return None

        snapshot_a = va.get("snapshot", {})
        snapshot_b = vb.get("snapshot", {})

        diff = self._compute_diff(snapshot_a, snapshot_b)
        return {
            "version_a": {"id": va["id"], "version": va["version"]},
            "version_b": {"id": vb["id"], "version": vb["version"]},
            "diff": diff,
            "summary": self._summarize_diff(diff),
        }

    # ==================== Revert ====================

    async def revert_to_version(
        self,
        artifact_type: str,
        artifact_id: str,
        version_id: str,
        reverted_by: Optional[str] = None,
        reverted_by_name: str = "",
        project_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Non-destructive revert: creates new version with old snapshot."""
        version = await self.get_version(artifact_type, artifact_id, version_id)
        if not version:
            return None

        return await self.create_version(
            artifact_type=artifact_type,
            artifact_id=artifact_id,
            snapshot=version["snapshot"],
            changed_by=reverted_by,
            changed_by_name=reverted_by_name,
            project_id=project_id,
            org_id=org_id,
            branch=version.get("branch_name", "main"),
            change_type="restored",
            diff_summary=f"Reverted to version {version['version']}",
        )

    # ==================== Branching ====================

    async def create_branch(
        self,
        artifact_type: str,
        artifact_id: str,
        branch_name: str,
        from_version_id: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new branch from a specific version (or latest main)."""
        # Get the source version snapshot
        if from_version_id:
            source = await self.get_version(artifact_type, artifact_id, from_version_id)
        else:
            # Use latest main version
            versions = await self.list_versions(artifact_type, artifact_id, "main", limit=1)
            if versions:
                source = await self.get_version(artifact_type, artifact_id, versions[0]["id"])
            else:
                return {"success": False, "message": "No versions exist to branch from"}

        if not source:
            return {"success": False, "message": "Source version not found"}

        # Create branch record
        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    branch_id = str(uuid4())
                    cur.execute(
                        """INSERT INTO artifact_branches
                           (id, artifact_type, artifact_id, branch_name,
                            created_from_version_id, created_by)
                           VALUES (%s, %s, %s, %s, %s, %s)
                           ON CONFLICT (artifact_type, artifact_id, branch_name) DO NOTHING""",
                        (branch_id, artifact_type, artifact_id, branch_name,
                         from_version_id or source["id"], created_by),
                    )
                    conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Create branch error: {e}")
            finally:
                pool.putconn(conn)

        # Create initial version on the new branch
        await self.create_version(
            artifact_type=artifact_type,
            artifact_id=artifact_id,
            snapshot=source["snapshot"],
            changed_by=created_by,
            branch=branch_name,
            change_type="branched",
            diff_summary=f"Branched from main v{source['version']}",
            project_id=source.get("project_id"),
            org_id=source.get("org_id"),
        )

        return {
            "success": True,
            "branch_name": branch_name,
            "from_version": source["version"],
            "message": f"Branch '{branch_name}' created from version {source['version']}",
        }

    async def merge_branch(
        self,
        artifact_type: str,
        artifact_id: str,
        source_branch: str,
        target_branch: str = "main",
        merged_by: Optional[str] = None,
        merged_by_name: str = "",
        project_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Merge a branch into target (default: main)."""
        # Get latest version from source branch
        source_versions = await self.list_versions(
            artifact_type, artifact_id, source_branch, limit=1
        )
        if not source_versions:
            return {"success": False, "message": f"No versions on branch '{source_branch}'"}

        source = await self.get_version(artifact_type, artifact_id, source_versions[0]["id"])
        if not source:
            return {"success": False, "message": "Could not read source branch version"}

        # Create merged version on target branch
        result = await self.create_version(
            artifact_type=artifact_type,
            artifact_id=artifact_id,
            snapshot=source["snapshot"],
            changed_by=merged_by,
            changed_by_name=merged_by_name,
            branch=target_branch,
            change_type="merged",
            diff_summary=f"Merged from '{source_branch}' v{source['version']}",
            project_id=project_id,
            org_id=org_id,
        )

        # Mark branch as merged
        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE artifact_branches
                           SET merged_at = NOW(), merged_by = %s,
                               merge_target_branch = %s, is_active = false
                           WHERE artifact_type = %s AND artifact_id = %s AND branch_name = %s""",
                        (merged_by, target_branch, artifact_type, artifact_id, source_branch),
                    )
                    conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Mark branch merged error: {e}")
            finally:
                pool.putconn(conn)

        return {
            "success": True,
            "message": f"Merged '{source_branch}' into '{target_branch}'",
            "merged_version": result,
        }

    async def list_branches(
        self,
        artifact_type: str,
        artifact_id: str,
        include_merged: bool = False,
    ) -> List[Dict[str, Any]]:
        """List branches for an artifact."""
        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    if include_merged:
                        cur.execute(
                            """SELECT branch_name, created_at, merged_at, is_active, created_by
                               FROM artifact_branches
                               WHERE artifact_type = %s AND artifact_id = %s
                               ORDER BY created_at""",
                            (artifact_type, artifact_id),
                        )
                    else:
                        cur.execute(
                            """SELECT branch_name, created_at, merged_at, is_active, created_by
                               FROM artifact_branches
                               WHERE artifact_type = %s AND artifact_id = %s AND is_active = true
                               ORDER BY created_at""",
                            (artifact_type, artifact_id),
                        )
                    rows = cur.fetchall()
                    branches = [
                        {
                            "branch_name": r[0],
                            "created_at": r[1].isoformat() if r[1] else None,
                            "merged_at": r[2].isoformat() if r[2] else None,
                            "is_active": r[3],
                            "created_by": str(r[4]) if r[4] else None,
                        }
                        for r in rows
                    ]
                    # Always include 'main' even if no explicit branch record
                    if not any(b["branch_name"] == "main" for b in branches):
                        branches.insert(0, {
                            "branch_name": "main",
                            "created_at": None,
                            "merged_at": None,
                            "is_active": True,
                            "created_by": None,
                        })
                    return branches
            except Exception as e:
                logger.error(f"List branches error: {e}")
                return [{"branch_name": "main", "is_active": True}]
            finally:
                pool.putconn(conn)
        else:
            # Memory fallback
            branches = set()
            for key in self._memory_versions:
                atype, aid, branch = key
                if atype == artifact_type and aid == str(artifact_id):
                    branches.add(branch)
            if not branches:
                branches.add("main")
            return [{"branch_name": b, "is_active": True} for b in sorted(branches)]

    # ==================== Diff Computation ====================

    def _compute_diff(
        self, old: Dict[str, Any], new: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compute diff between two JSONB snapshots."""
        diff = {"added": {}, "removed": {}, "changed": {}}

        all_keys = set(list(old.keys()) + list(new.keys()))

        for key in all_keys:
            old_val = old.get(key)
            new_val = new.get(key)

            if key not in old:
                diff["added"][key] = new_val
            elif key not in new:
                diff["removed"][key] = old_val
            elif old_val != new_val:
                diff["changed"][key] = {"old": old_val, "new": new_val}

        return diff

    def _summarize_diff(self, diff: Dict[str, Any]) -> str:
        """Generate human-readable diff summary."""
        parts = []
        added = len(diff.get("added", {}))
        removed = len(diff.get("removed", {}))
        changed = len(diff.get("changed", {}))

        if added:
            parts.append(f"{added} field(s) added")
        if removed:
            parts.append(f"{removed} field(s) removed")
        if changed:
            changed_keys = list(diff.get("changed", {}).keys())[:3]
            parts.append(f"{changed} field(s) changed ({', '.join(changed_keys)})")

        return "; ".join(parts) if parts else "No changes"


# ==================== Global Instance ====================

universal_version_service = UniversalVersionService()
