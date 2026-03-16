"""
Git Export/Sync Service — Export & Import Project Artifacts as File Trees

Exports all project artifacts (test cases, API collections, performance scenarios,
mobile flows, visual baselines, accessibility configs, etc.) into a structured
file tree suitable for Git version control.

Also generates CI/CD pipeline configs for GitHub Actions, GitLab CI, Jenkins,
and Azure Pipelines.

Usage:
    from app.services.core.git_export_service import git_export_service

    # Export entire project to file tree
    tree = await git_export_service.export_project(project_id, org_id)

    # Import project from file tree
    result = await git_export_service.import_project(project_id, org_id, tree, user_id)

    # Generate CI pipeline
    config = await git_export_service.generate_ci_pipeline(project_id, "github_actions")
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

import yaml

logger = logging.getLogger(__name__)


class GitExportService:
    """Exports/imports project artifacts as structured file trees for Git."""

    def __init__(self):
        self._pool = None

    def _get_pool(self):
        if self._pool:
            return self._pool
        try:
            from app.services.storage.database import get_database_client
            self._pool = get_database_client()
            return self._pool
        except Exception:
            return None

    # ==================== Export ====================

    async def export_project(
        self,
        project_id: str,
        org_id: str,
        include_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Export all project artifacts into a structured file tree.

        Returns:
            {
                "metadata": { project, org, exported_at, version },
                "files": { "path/to/file.json": { content }, ... }
            }
        """
        include_types = include_types or [
            "test_cases", "test_plans", "api_collections",
            "perf_scenarios", "mobile_flows", "visual_baselines",
            "a11y_configs", "defects", "requirements",
        ]

        files: Dict[str, Any] = {}
        metadata = {
            "project_id": project_id,
            "org_id": org_id,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "format_version": "1.0.0",
            "qaai_version": "3.27.0",
        }

        pool = self._get_pool()

        if "test_cases" in include_types:
            test_cases = await self._export_table(
                pool, "test_cases", project_id,
                columns=["id", "title", "description", "steps", "priority",
                         "status", "tags", "folder_id", "created_at"]
            )
            for tc in test_cases:
                path = f"test-cases/{tc.get('id', 'unknown')}.json"
                files[path] = tc

        if "test_plans" in include_types:
            test_plans = await self._export_table(
                pool, "test_plans", project_id,
                columns=["id", "name", "description", "test_case_ids",
                         "status", "created_at"]
            )
            for tp in test_plans:
                path = f"test-plans/{tp.get('id', 'unknown')}.json"
                files[path] = tp

        if "api_collections" in include_types:
            collections = await self._export_table(
                pool, "api_collections", project_id,
                columns=["id", "name", "description", "base_url",
                         "requests", "folders", "created_at"]
            )
            for col in collections:
                path = f"api-collections/{col.get('id', 'unknown')}.json"
                files[path] = col

        if "mobile_flows" in include_types:
            flows = await self._export_table(
                pool, "mobile_flows", project_id,
                columns=["id", "name", "description", "yaml_content",
                         "platform", "tags", "created_at"]
            )
            for flow in flows:
                path = f"mobile-flows/{flow.get('id', 'unknown')}.yaml"
                files[path] = flow

        if "defects" in include_types:
            defects = await self._export_table(
                pool, "defects", project_id,
                columns=["id", "title", "description", "severity",
                         "status", "assigned_to", "created_at"]
            )
            for defect in defects:
                path = f"defects/{defect.get('id', 'unknown')}.json"
                files[path] = defect

        if "requirements" in include_types:
            reqs = await self._export_table(
                pool, "requirements", project_id,
                columns=["id", "title", "description", "type",
                         "priority", "status", "created_at"]
            )
            for req in reqs:
                path = f"requirements/{req.get('id', 'unknown')}.json"
                files[path] = req

        return {
            "metadata": metadata,
            "files": files,
            "summary": {
                "total_files": len(files),
                "types": {k: sum(1 for f in files if f.startswith(k.replace("_", "-")))
                          for k in include_types},
            },
        }

    async def _export_table(
        self, pool, table: str, project_id: str,
        columns: List[str],
    ) -> List[Dict[str, Any]]:
        """Export rows from a table for a project."""
        if not pool:
            return []

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cols = ", ".join(columns)
                cur.execute(
                    f"SELECT {cols} FROM {table} WHERE project_id = %s ORDER BY created_at",
                    (project_id,),
                )
                rows = cur.fetchall()
                results = []
                for row in rows:
                    record = {}
                    for i, col in enumerate(columns):
                        val = row[i]
                        if isinstance(val, datetime):
                            val = val.isoformat()
                        elif hasattr(val, '__str__') and not isinstance(val, (str, int, float, bool, list, dict)):
                            val = str(val)
                        record[col] = val
                    results.append(record)
                return results
        except Exception as e:
            logger.error(f"Export table {table} error: {e}")
            return []
        finally:
            pool.putconn(conn)

    # ==================== Import ====================

    async def import_project(
        self,
        project_id: str,
        org_id: str,
        file_tree: Dict[str, Any],
        user_id: str,
        mode: str = "merge",
    ) -> Dict[str, Any]:
        """
        Import artifacts from a file tree into a project.

        Args:
            mode: "merge" (update existing, add new) or "replace" (clear + import)

        Returns:
            { success, imported, skipped, errors }
        """
        files = file_tree.get("files", {})
        imported = 0
        skipped = 0
        errors = []

        pool = self._get_pool()
        if not pool:
            return {"success": False, "message": "Database not available"}

        for path, content in files.items():
            try:
                artifact_type = self._path_to_type(path)
                if not artifact_type:
                    skipped += 1
                    continue

                # Ensure project_id and org_id are set
                content["project_id"] = project_id
                content["org_id"] = org_id

                await self._import_artifact(pool, artifact_type, content, user_id, mode)
                imported += 1
            except Exception as e:
                errors.append({"path": path, "error": str(e)})

        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "errors": errors,
            "total": len(files),
        }

    def _path_to_type(self, path: str) -> Optional[str]:
        """Map file path to table name."""
        mapping = {
            "test-cases/": "test_cases",
            "test-plans/": "test_plans",
            "api-collections/": "api_collections",
            "mobile-flows/": "mobile_flows",
            "defects/": "defects",
            "requirements/": "requirements",
        }
        for prefix, table in mapping.items():
            if path.startswith(prefix):
                return table
        return None

    async def _import_artifact(
        self, pool, table: str, data: Dict, user_id: str, mode: str
    ):
        """Import a single artifact using UPSERT."""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                artifact_id = data.get("id", str(uuid4()))
                data["id"] = artifact_id

                # Check if exists
                cur.execute(f"SELECT id FROM {table} WHERE id = %s", (artifact_id,))
                exists = cur.fetchone()

                if exists and mode == "merge":
                    # Update existing — simplified: set all columns
                    cols = [k for k in data.keys() if k not in ("id", "created_at")]
                    set_clause = ", ".join(f"{c} = %s" for c in cols)
                    values = [self._serialize_value(data[c]) for c in cols]
                    values.append(artifact_id)
                    cur.execute(
                        f"UPDATE {table} SET {set_clause} WHERE id = %s",
                        values,
                    )
                elif not exists:
                    cols = list(data.keys())
                    placeholders = ", ".join(["%s"] * len(cols))
                    col_names = ", ".join(cols)
                    values = [self._serialize_value(data[c]) for c in cols]
                    cur.execute(
                        f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",
                        values,
                    )

                conn.commit()
        except Exception as e:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)

    def _serialize_value(self, val):
        """Serialize value for PostgreSQL."""
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return val

    # ==================== CI/CD Pipeline Generation ====================

    async def generate_ci_pipeline(
        self,
        project_id: str,
        format: str = "github_actions",
        options: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Generate CI/CD pipeline configuration for a project.

        Supported formats: github_actions, gitlab_ci, jenkins, azure_pipelines
        """
        options = options or {}
        generators = {
            "github_actions": self._gen_github_actions,
            "gitlab_ci": self._gen_gitlab_ci,
            "jenkins": self._gen_jenkinsfile,
            "azure_pipelines": self._gen_azure_pipelines,
        }

        generator = generators.get(format)
        if not generator:
            return {"success": False, "error": f"Unknown format: {format}"}

        config = generator(project_id, options)
        return {
            "success": True,
            "format": format,
            "filename": config["filename"],
            "content": config["content"],
        }

    def _gen_github_actions(self, project_id: str, options: Dict) -> Dict:
        """Generate GitHub Actions workflow."""
        content = f"""name: QAAI Test Suite
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1-5'  # Weekdays at 6am UTC

env:
  QAAI_API_URL: ${{{{ secrets.QAAI_API_URL }}}}
  QAAI_API_TOKEN: ${{{{ secrets.QAAI_API_TOKEN }}}}
  QAAI_PROJECT_ID: {project_id}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run QAAI Tests
        run: |
          curl -sf -X POST "$QAAI_API_URL/api/ci/trigger" \\
            -H "X-API-Key: $QAAI_API_TOKEN" \\
            -H "Content-Type: application/json" \\
            -d '{{"project_id": "'$QAAI_PROJECT_ID'", "trigger": "github_actions", "ref": "'$GITHUB_SHA'"}}'

      - name: Poll Results
        run: |
          for i in $(seq 1 60); do
            RESULT=$(curl -sf "$QAAI_API_URL/api/ci/status/$QAAI_PROJECT_ID" \\
              -H "X-API-Key: $QAAI_API_TOKEN")
            STATUS=$(echo $RESULT | jq -r '.status')
            if [ "$STATUS" = "completed" ]; then
              PASSED=$(echo $RESULT | jq -r '.passed')
              FAILED=$(echo $RESULT | jq -r '.failed')
              echo "Tests: $PASSED passed, $FAILED failed"
              if [ "$FAILED" -gt 0 ]; then exit 1; fi
              exit 0
            fi
            sleep 10
          done
          echo "Timeout waiting for test results"
          exit 1
"""
        return {"filename": ".github/workflows/qaai-tests.yml", "content": content}

    def _gen_gitlab_ci(self, project_id: str, options: Dict) -> Dict:
        """Generate GitLab CI config."""
        content = f"""stages:
  - test

qaai-tests:
  stage: test
  image: curlimages/curl:latest
  variables:
    QAAI_PROJECT_ID: {project_id}
  script:
    - |
      curl -sf -X POST "$QAAI_API_URL/api/ci/trigger" \\
        -H "X-API-Key: $QAAI_API_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d '{{"project_id": "'$QAAI_PROJECT_ID'", "trigger": "gitlab_ci", "ref": "'$CI_COMMIT_SHA'"}}'
    - |
      for i in $(seq 1 60); do
        RESULT=$(curl -sf "$QAAI_API_URL/api/ci/status/$QAAI_PROJECT_ID" \\
          -H "X-API-Key: $QAAI_API_TOKEN")
        STATUS=$(echo $RESULT | jq -r '.status')
        if [ "$STATUS" = "completed" ]; then
          FAILED=$(echo $RESULT | jq -r '.failed')
          if [ "$FAILED" -gt 0 ]; then exit 1; fi
          exit 0
        fi
        sleep 10
      done
      exit 1
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
"""
        return {"filename": ".gitlab-ci.yml", "content": content}

    def _gen_jenkinsfile(self, project_id: str, options: Dict) -> Dict:
        """Generate Jenkinsfile."""
        content = f"""pipeline {{
    agent any
    environment {{
        QAAI_API_URL = credentials('qaai-api-url')
        QAAI_API_TOKEN = credentials('qaai-api-token')
        QAAI_PROJECT_ID = '{project_id}'
    }}
    stages {{
        stage('Run QAAI Tests') {{
            steps {{
                script {{
                    sh '''
                    curl -sf -X POST "$QAAI_API_URL/api/ci/trigger" \\
                        -H "X-API-Key: $QAAI_API_TOKEN" \\
                        -H "Content-Type: application/json" \\
                        -d '{{"project_id": "'$QAAI_PROJECT_ID'", "trigger": "jenkins"}}'
                    '''
                }}
            }}
        }}
        stage('Wait for Results') {{
            steps {{
                script {{
                    def result = ''
                    for (int i = 0; i < 60; i++) {{
                        result = sh(script: "curl -sf $QAAI_API_URL/api/ci/status/$QAAI_PROJECT_ID -H 'X-API-Key: $QAAI_API_TOKEN'", returnStdout: true)
                        def json = readJSON text: result
                        if (json.status == 'completed') {{
                            if (json.failed > 0) {{
                                error "QAAI tests failed: ${{json.failed}} failures"
                            }}
                            break
                        }}
                        sleep 10
                    }}
                }}
            }}
        }}
    }}
}}
"""
        return {"filename": "Jenkinsfile", "content": content}

    def _gen_azure_pipelines(self, project_id: str, options: Dict) -> Dict:
        """Generate Azure Pipelines config."""
        content = f"""trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  QAAI_PROJECT_ID: {project_id}

steps:
  - script: |
      curl -sf -X POST "$(QAAI_API_URL)/api/ci/trigger" \\
        -H "X-API-Key: $(QAAI_API_TOKEN)" \\
        -H "Content-Type: application/json" \\
        -d '{{"project_id": "$(QAAI_PROJECT_ID)", "trigger": "azure_pipelines"}}'
    displayName: 'Trigger QAAI Tests'

  - script: |
      for i in $(seq 1 60); do
        RESULT=$(curl -sf "$(QAAI_API_URL)/api/ci/status/$(QAAI_PROJECT_ID)" \\
          -H "X-API-Key: $(QAAI_API_TOKEN)")
        STATUS=$(echo $RESULT | jq -r '.status')
        if [ "$STATUS" = "completed" ]; then
          FAILED=$(echo $RESULT | jq -r '.failed')
          if [ "$FAILED" -gt 0 ]; then exit 1; fi
          exit 0
        fi
        sleep 10
      done
      exit 1
    displayName: 'Wait for Results'
"""
        return {"filename": "azure-pipelines.yml", "content": content}

    # ==================== Webhook ====================

    async def handle_webhook(
        self,
        org_id: str,
        project_id: str,
        payload: Dict[str, Any],
        source: str,
    ) -> Dict[str, Any]:
        """
        Handle incoming Git webhook (push, PR, etc.)
        Can trigger test runs or sync artifacts.
        """
        event_type = payload.get("event_type") or payload.get("action", "push")
        ref = payload.get("ref", "")
        commit = payload.get("after") or payload.get("commit", {}).get("id", "")

        logger.info(f"Git webhook: source={source}, event={event_type}, ref={ref}")

        # Could trigger automated test runs here
        return {
            "received": True,
            "source": source,
            "event_type": event_type,
            "ref": ref,
            "commit": commit[:12] if commit else None,
            "message": "Webhook received. Automated triggers can be configured in project settings.",
        }

    # ==================== Git Config ====================

    async def get_git_config(self, project_id: str, org_id: str) -> Dict[str, Any]:
        """Get Git sync configuration for a project."""
        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT git_repo_url, git_branch, git_sync_enabled,
                                  git_auto_export, git_webhook_secret, git_provider
                           FROM projects WHERE id = %s AND org_id = %s""",
                        (project_id, org_id),
                    )
                    row = cur.fetchone()
                    if row:
                        return {
                            "repo_url": row[0] or "",
                            "branch": row[1] or "main",
                            "sync_enabled": row[2] or False,
                            "auto_export": row[3] or False,
                            "has_webhook_secret": bool(row[4]),
                            "provider": row[5] or "github",
                        }
            except Exception as e:
                logger.error(f"Get git config error: {e}")
            finally:
                pool.putconn(conn)

        return {
            "repo_url": "",
            "branch": "main",
            "sync_enabled": False,
            "auto_export": False,
            "has_webhook_secret": False,
            "provider": "github",
        }

    async def update_git_config(
        self,
        project_id: str,
        org_id: str,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update Git sync configuration for a project."""
        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    # Only update fields that are provided
                    updates = []
                    values = []
                    field_map = {
                        "repo_url": "git_repo_url",
                        "branch": "git_branch",
                        "sync_enabled": "git_sync_enabled",
                        "auto_export": "git_auto_export",
                        "webhook_secret": "git_webhook_secret",
                        "provider": "git_provider",
                    }
                    for key, col in field_map.items():
                        if key in config:
                            updates.append(f"{col} = %s")
                            values.append(config[key])

                    if updates:
                        set_clause = ", ".join(updates)
                        values.extend([project_id, org_id])
                        cur.execute(
                            f"UPDATE projects SET {set_clause} WHERE id = %s AND org_id = %s",
                            values,
                        )
                        conn.commit()

                    return {"success": True, "message": "Git config updated"}
            except Exception as e:
                conn.rollback()
                logger.error(f"Update git config error: {e}")
                return {"success": False, "message": "Failed to update config"}
            finally:
                pool.putconn(conn)

        return {"success": False, "message": "Database not available"}


# ==================== Global Instance ====================

git_export_service = GitExportService()
