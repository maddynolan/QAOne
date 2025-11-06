"""
GitHub Connector Service
Handles GitHub webhooks, PR integration, and diff-based test impact analysis.
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


class GitHubEventType(Enum):
    PULL_REQUEST = "pull_request"
    PUSH = "push"
    ISSUES = "issues"
    ISSUE_COMMENT = "issue_comment"
    PULL_REQUEST_REVIEW = "pull_request_review"


class GitHubConnector:
    """
    Service for integrating with GitHub API and webhooks.
    Handles PR hooks, diff analysis, commit metadata, and test impact detection.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        webhook_secret: Optional[str] = None,
        base_url: str = "https://api.github.com"
    ):
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.webhook_secret = webhook_secret or os.getenv("GITHUB_WEBHOOK_SECRET")
        self.base_url = base_url
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "QA-AI-Platform/1.0"
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    async def verify_webhook_signature(
        self,
        payload_body: bytes,
        signature_header: str
    ) -> bool:
        """
        Verify GitHub webhook signature.
        
        Args:
            payload_body: Raw request body
            signature_header: X-Hub-Signature-256 header value
            
        Returns:
            True if signature is valid
        """
        if not self.webhook_secret:
            logger.warning("No webhook secret configured, skipping verification")
            return True

        if not signature_header.startswith("sha256="):
            return False

        expected_signature = signature_header[7:]  # Remove "sha256=" prefix
        computed_signature = hmac.new(
            self.webhook_secret.encode(),
            payload_body,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected_signature, computed_signature)

    async def handle_webhook(
        self,
        event_type: str,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle GitHub webhook event.
        
        Returns:
            Dict with action taken and metadata
        """
        event = GitHubEventType(event_type) if event_type in [e.value for e in GitHubEventType] else None

        if event == GitHubEventType.PULL_REQUEST:
            return await self._handle_pull_request(payload)
        elif event == GitHubEventType.PUSH:
            return await self._handle_push(payload)
        elif event == GitHubEventType.ISSUES:
            return await self._handle_issue(payload)
        else:
            logger.info(f"Unhandled event type: {event_type}")
            return {"action": "ignored", "reason": f"Event type {event_type} not handled"}

    async def _handle_pull_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle pull request webhook"""
        pr = payload.get("pull_request", {})
        action = payload.get("action")  # opened, closed, synchronize, etc.

        pr_number = pr.get("number")
        repo_full_name = payload.get("repository", {}).get("full_name")
        base_sha = pr.get("base", {}).get("sha")
        head_sha = pr.get("head", {}).get("sha")

        logger.info(f"PR {action}: #{pr_number} in {repo_full_name}")

        if action in ["opened", "synchronize"]:
            # Get diff and analyze impact
            diff = await self.get_pr_diff(repo_full_name, pr_number)
            impacted_files = self._analyze_diff_for_impact(diff)

            return {
                "action": "pr_analyzed",
                "pr_number": pr_number,
                "repo": repo_full_name,
                "impacted_files": impacted_files,
                "impacted_tests": [],  # Will be populated by test impact analysis
                "suggested_tests": []  # Will be populated by AI
            }

        return {"action": "acknowledged", "pr_number": pr_number}

    async def _handle_push(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle push webhook"""
        ref = payload.get("ref", "")
        commits = payload.get("commits", [])
        repo_full_name = payload.get("repository", {}).get("full_name")

        logger.info(f"Push to {ref} in {repo_full_name}: {len(commits)} commits")

        if ref.startswith("refs/heads/"):
            branch = ref.replace("refs/heads/", "")
            # Could trigger test runs for the branch
            return {
                "action": "push_received",
                "branch": branch,
                "commits": len(commits)
            }

        return {"action": "ignored"}

    async def _handle_issue(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle issue webhook"""
        issue = payload.get("issue", {})
        action = payload.get("action")

        logger.info(f"Issue {action}: #{issue.get('number')}")

        # Could link issues to test cases or defects
        return {
            "action": "issue_received",
            "issue_number": issue.get("number"),
            "action_type": action
        }

    async def get_pr_diff(
        self,
        repo_full_name: str,
        pr_number: int
    ) -> str:
        """Get PR diff as text"""
        if not self.token:
            raise ValueError("GitHub token required for API calls")

        url = f"{self.base_url}/repos/{repo_full_name}/pulls/{pr_number}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    pr_data = await response.json()
                    diff_url = pr_data.get("diff_url")
                    
                    # Fetch diff
                    async with session.get(diff_url, headers=self.headers) as diff_response:
                        if diff_response.status == 200:
                            return await diff_response.text()
                        else:
                            raise Exception(f"Failed to fetch diff: {diff_response.status}")

    def _analyze_diff_for_impact(self, diff: str) -> List[Dict[str, Any]]:
        """
        Analyze diff to identify impacted files and modules.
        
        Returns:
            List of impacted files with metadata
        """
        impacted_files = []
        current_file = None

        for line in diff.split("\n"):
            if line.startswith("diff --git"):
                # New file in diff
                parts = line.split()
                if len(parts) >= 3:
                    file_path = parts[2].replace("b/", "")
                    current_file = {
                        "path": file_path,
                        "changes": {
                            "additions": 0,
                            "deletions": 0,
                            "modifications": []
                        }
                    }
                    impacted_files.append(current_file)

            elif line.startswith("+") and current_file:
                current_file["changes"]["additions"] += 1
            elif line.startswith("-") and current_file:
                current_file["changes"]["deletions"] += 1

        # Add file type and module info
        for file_info in impacted_files:
            file_path = file_info["path"]
            file_info["file_type"] = self._get_file_type(file_path)
            file_info["module"] = self._extract_module(file_path)

        return impacted_files

    def _get_file_type(self, file_path: str) -> str:
        """Determine file type from path"""
        if file_path.endswith((".ts", ".tsx", ".js", ".jsx")):
            return "frontend"
        elif file_path.endswith((".py", ".java", ".go", ".rs")):
            return "backend"
        elif file_path.endswith((".html", ".css")):
            return "ui"
        elif file_path.endswith((".yml", ".yaml")):
            return "config"
        elif "test" in file_path.lower() or "spec" in file_path.lower():
            return "test"
        else:
            return "other"

    def _extract_module(self, file_path: str) -> str:
        """Extract module/component name from file path"""
        parts = file_path.split("/")
        if len(parts) >= 2:
            return parts[-2]  # Second-to-last part is often module
        return parts[-1].split(".")[0] if parts else "unknown"

    async def get_commit_metadata(
        self,
        repo_full_name: str,
        sha: str
    ) -> Dict[str, Any]:
        """Get metadata for a commit"""
        if not self.token:
            raise ValueError("GitHub token required")

        url = f"{self.base_url}/repos/{repo_full_name}/commits/{sha}"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    raise Exception(f"Failed to fetch commit: {response.status}")

    async def create_check_run(
        self,
        repo_full_name: str,
        name: str,
        head_sha: str,
        status: str = "completed",  # queued, in_progress, completed
        conclusion: str = "success",  # success, failure, neutral, cancelled, skipped
        output: Optional[Dict[str, Any]] = None
    ):
        """Create a GitHub check run (for CI/CD integration)"""
        if not self.token:
            raise ValueError("GitHub token required")

        url = f"{self.base_url}/repos/{repo_full_name}/check-runs"

        payload = {
            "name": name,
            "head_sha": head_sha,
            "status": status,
            "conclusion": conclusion if status == "completed" else None,
            "output": output or {}
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status == 201:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise Exception(f"Failed to create check run: {response.status} - {error_text}")

    async def add_pr_comment(
        self,
        repo_full_name: str,
        pr_number: int,
        comment: str
    ):
        """Add a comment to a pull request"""
        if not self.token:
            raise ValueError("GitHub token required")

        url = f"{self.base_url}/repos/{repo_full_name}/issues/{pr_number}/comments"

        payload = {"body": comment}

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status == 201:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise Exception(f"Failed to add comment: {response.status} - {error_text}")


# Global instance
github_connector = GitHubConnector()

