"""
Jira Connector - Integration with Jira for requirements sync
Phase 2.1: Requirements Intelligence Agent
"""

import os
import logging
import aiohttp
from typing import Dict, List, Any, Optional
from datetime import datetime
import base64

logger = logging.getLogger(__name__)


class JiraConnector:
    """
    Connector for Jira API to sync requirements/stories
    """
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        email: Optional[str] = None,
        api_token: Optional[str] = None
    ):
        self.base_url = base_url or os.getenv("JIRA_BASE_URL", "").rstrip("/")
        self.email = email or os.getenv("JIRA_EMAIL", "")
        self.api_token = api_token or os.getenv("JIRA_API_TOKEN", "")
        
        if not self.base_url or not self.email or not self.api_token:
            logger.warning("Jira credentials not configured. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN")
        
        # Create basic auth header
        if self.email and self.api_token:
            auth_string = f"{self.email}:{self.api_token}"
            auth_bytes = auth_string.encode("ascii")
            auth_b64 = base64.b64encode(auth_bytes).decode("ascii")
            self.headers = {
                "Authorization": f"Basic {auth_b64}",
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        else:
            self.headers = {}
    
    async def get_issue(self, issue_key: str) -> Optional[Dict[str, Any]]:
        """Get a Jira issue by key"""
        if not self.base_url:
            raise ValueError("Jira not configured")
        
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=self.headers) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"Jira API error {response.status}: {error_text}")
                        raise Exception(f"Jira API error: {response.status}")
            except Exception as e:
                logger.error(f"Failed to fetch Jira issue {issue_key}: {e}")
                raise
    
    async def search_issues(
        self,
        jql: str,
        fields: Optional[List[str]] = None,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """Search Jira issues using JQL"""
        if not self.base_url:
            raise ValueError("Jira not configured")
        
        url = f"{self.base_url}/rest/api/3/search"
        
        fields = fields or ["summary", "description", "status", "assignee", "created", "updated"]
        
        params = {
            "jql": jql,
            "fields": ",".join(fields),
            "maxResults": max_results
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=self.headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("issues", [])
                    else:
                        error_text = await response.text()
                        logger.error(f"Jira search error {response.status}: {error_text}")
                        raise Exception(f"Jira search error: {response.status}")
            except Exception as e:
                logger.error(f"Failed to search Jira issues: {e}")
                raise
    
    async def get_project_issues(
        self,
        project_key: str,
        issue_types: Optional[List[str]] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all issues for a project"""
        issue_types = issue_types or ["Story", "Task", "Bug"]
        
        jql_parts = [f"project = {project_key}"]
        jql_parts.append(f"issuetype IN ({', '.join(issue_types)})")
        
        if status:
            jql_parts.append(f"status = '{status}'")
        
        jql = " AND ".join(jql_parts)
        return await self.search_issues(jql)
    
    def parse_issue_to_requirement(self, issue: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Jira issue to requirement format"""
        fields = issue.get("fields", {})
        
        return {
            "source": "jira",
            "source_ref": issue.get("key", ""),
            "title": fields.get("summary", ""),
            "description": fields.get("description", ""),
            "status": fields.get("status", {}).get("name", ""),
            "assignee": fields.get("assignee", {}).get("displayName", "") if fields.get("assignee") else None,
            "created_at": fields.get("created", ""),
            "updated_at": fields.get("updated", ""),
            "raw_payload": issue
        }

