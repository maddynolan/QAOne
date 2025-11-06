"""
CI/CD Connector Service
Handles webhooks and integration with CI/CD systems: GitHub Actions, Jenkins, GitLab CI
"""

import os
import hmac
import hashlib
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
import aiohttp
from enum import Enum

logger = logging.getLogger(__name__)


class CICDProvider(Enum):
    GITHUB_ACTIONS = "github_actions"
    JENKINS = "jenkins"
    GITLAB_CI = "gitlab_ci"
    CIRCLE_CI = "circle_ci"
    AZURE_DEVOPS = "azure_devops"


class CICDConnector:
    """
    Service for integrating with CI/CD systems.
    Handles webhooks, test triggers, and status reporting.
    """

    def __init__(self):
        self.github_webhook_secret = os.getenv("GITHUB_WEBHOOK_SECRET")
        self.jenkins_token = os.getenv("JENKINS_API_TOKEN")
        self.gitlab_token = os.getenv("GITLAB_TOKEN")
        self.gitlab_secret = os.getenv("GITLAB_WEBHOOK_SECRET")

    async def handle_github_actions_webhook(
        self,
        payload: Dict[str, Any],
        signature: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle GitHub Actions webhook"""
        event_type = payload.get("action", "")
        workflow_run = payload.get("workflow_run", {})
        
        logger.info(f"GitHub Actions event: {event_type}")

        if event_type == "completed":
            status = workflow_run.get("conclusion", "unknown")
            workflow_name = workflow_run.get("name", "")
            commit_sha = workflow_run.get("head_sha", "")
            
            # Trigger tests if workflow succeeded
            if status == "success":
                return {
                    "action": "trigger_tests",
                    "provider": "github_actions",
                    "workflow": workflow_name,
                    "commit": commit_sha,
                    "status": status
                }

        return {"action": "acknowledged", "provider": "github_actions"}

    async def handle_jenkins_webhook(
        self,
        payload: Dict[str, Any],
        auth_header: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle Jenkins webhook"""
        build_url = payload.get("build", {}).get("full_url", "")
        build_status = payload.get("build", {}).get("status", "")
        build_number = payload.get("build", {}).get("number", "")
        
        logger.info(f"Jenkins build event: {build_status}")

        # Verify Jenkins token if provided
        if self.jenkins_token and auth_header:
            if auth_header != f"Bearer {self.jenkins_token}":
                raise ValueError("Invalid Jenkins token")

        if build_status == "SUCCESS":
            return {
                "action": "trigger_tests",
                "provider": "jenkins",
                "build_url": build_url,
                "build_number": build_number,
                "status": build_status
            }

        return {"action": "acknowledged", "provider": "jenkins"}

    async def handle_gitlab_ci_webhook(
        self,
        payload: Dict[str, Any],
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle GitLab CI webhook"""
        object_kind = payload.get("object_kind", "")
        build_status = payload.get("build_status", "")
        commit_sha = payload.get("commit", {}).get("sha", "")
        pipeline_id = payload.get("object_attributes", {}).get("id", "")
        
        logger.info(f"GitLab CI event: {object_kind}, status: {build_status}")

        # Verify GitLab token if provided
        if self.gitlab_secret and token:
            if token != self.gitlab_secret:
                raise ValueError("Invalid GitLab token")

        if object_kind == "pipeline" and build_status == "success":
            return {
                "action": "trigger_tests",
                "provider": "gitlab_ci",
                "pipeline_id": pipeline_id,
                "commit": commit_sha,
                "status": build_status
            }

        return {"action": "acknowledged", "provider": "gitlab_ci"}

    async def trigger_test_run(
        self,
        provider: CICDProvider,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Trigger a test run based on CI/CD event.
        
        Args:
            provider: CI/CD provider
            context: Context from CI/CD event (commit, branch, etc.)
            
        Returns:
            Dict with test run information
        """
        commit_sha = context.get("commit_sha") or context.get("commit")
        branch = context.get("branch") or context.get("ref", "").replace("refs/heads/", "")
        project_id = context.get("project_id")
        org_id = context.get("org_id")

        # Determine which tests to run based on changes
        # This would integrate with run-matrix and planner
        
        return {
            "status": "triggered",
            "provider": provider.value,
            "commit": commit_sha,
            "branch": branch,
            "test_run_id": None,  # Will be populated when run is created
            "message": f"Test run triggered from {provider.value}"
        }

    async def report_test_status(
        self,
        provider: CICDProvider,
        build_id: str,
        test_status: str,
        test_results: Optional[Dict[str, Any]] = None
    ):
        """Report test results back to CI/CD system"""
        if provider == CICDProvider.GITHUB_ACTIONS:
            # Update GitHub check run
            return await self._update_github_check(build_id, test_status, test_results)
        elif provider == CICDProvider.JENKINS:
            # Update Jenkins build
            return await self._update_jenkins_build(build_id, test_status, test_results)
        elif provider == CICDProvider.GITLAB_CI:
            # Update GitLab CI pipeline
            return await self._update_gitlab_pipeline(build_id, test_status, test_results)

    async def _update_github_check(
        self,
        check_run_id: str,
        status: str,
        results: Optional[Dict[str, Any]]
    ):
        """Update GitHub check run status"""
        # This would use GitHub API to update check run
        logger.info(f"Updating GitHub check run {check_run_id} with status {status}")
        return {"status": "updated", "provider": "github_actions"}

    async def _update_jenkins_build(
        self,
        build_id: str,
        status: str,
        results: Optional[Dict[str, Any]]
    ):
        """Update Jenkins build with test results"""
        logger.info(f"Updating Jenkins build {build_id} with status {status}")
        return {"status": "updated", "provider": "jenkins"}

    async def _update_gitlab_pipeline(
        self,
        pipeline_id: str,
        status: str,
        results: Optional[Dict[str, Any]]
    ):
        """Update GitLab CI pipeline with test results"""
        logger.info(f"Updating GitLab pipeline {pipeline_id} with status {status}")
        return {"status": "updated", "provider": "gitlab_ci"}


# Global instance
cicd_connector = CICDConnector()

