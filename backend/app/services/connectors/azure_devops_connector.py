"""
Azure DevOps Connector - Integration with Azure DevOps for work items
Phase 2.1: Requirements Intelligence Agent
"""

import os
import logging
import aiohttp
from typing import Dict, List, Any, Optional
from datetime import datetime
import base64

logger = logging.getLogger(__name__)


class AzureDevOpsConnector:
    """
    Connector for Azure DevOps API to sync work items
    """
    
    def __init__(
        self,
        organization: Optional[str] = None,
        project: Optional[str] = None,
        personal_access_token: Optional[str] = None
    ):
        self.organization = organization or os.getenv("AZURE_DEVOPS_ORG", "")
        self.project = project or os.getenv("AZURE_DEVOPS_PROJECT", "")
        self.pat = personal_access_token or os.getenv("AZURE_DEVOPS_PAT", "")
        
        if not self.organization or not self.pat:
            logger.warning("Azure DevOps credentials not configured")
        
        self.base_url = f"https://dev.azure.com/{self.organization}"
        
        # Create PAT auth header
        if self.pat:
            pat_bytes = f":{self.pat}".encode("ascii")
            pat_b64 = base64.b64encode(pat_bytes).decode("ascii")
            self.headers = {
                "Authorization": f"Basic {pat_b64}",
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        else:
            self.headers = {}
    
    async def get_work_item(self, work_item_id: int) -> Optional[Dict[str, Any]]:
        """Get a work item by ID"""
        if not self.organization:
            raise ValueError("Azure DevOps not configured")
        
        url = f"{self.base_url}/{self.project}/_apis/wit/workitems/{work_item_id}"
        params = {"api-version": "7.1", "$expand": "all"}
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=self.headers, params=params) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"Azure DevOps API error {response.status}: {error_text}")
                        raise Exception(f"Azure DevOps API error: {response.status}")
            except Exception as e:
                logger.error(f"Failed to fetch work item {work_item_id}: {e}")
                raise
    
    async def query_work_items(self, wiql: str) -> List[Dict[str, Any]]:
        """Query work items using WIQL (Work Item Query Language)"""
        if not self.organization:
            raise ValueError("Azure DevOps not configured")
        
        url = f"{self.base_url}/{self.project}/_apis/wit/wiql"
        params = {"api-version": "7.1"}
        
        payload = {"query": wiql}
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(url, headers=self.headers, params=params, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        work_item_refs = data.get("workItems", [])
                        
                        # Fetch full work items
                        if work_item_refs:
                            ids = [wi["id"] for wi in work_item_refs]
                            return await self.get_work_items_batch(ids)
                        return []
                    else:
                        error_text = await response.text()
                        logger.error(f"Azure DevOps query error {response.status}: {error_text}")
                        raise Exception(f"Azure DevOps query error: {response.status}")
            except Exception as e:
                logger.error(f"Failed to query work items: {e}")
                raise
    
    async def get_work_items_batch(self, work_item_ids: List[int]) -> List[Dict[str, Any]]:
        """Get multiple work items by IDs"""
        if not self.organization:
            raise ValueError("Azure DevOps not configured")
        
        if not work_item_ids:
            return []
        
        # Azure DevOps allows up to 200 IDs per batch
        url = f"{self.base_url}/{self.project}/_apis/wit/workitems"
        params = {
            "api-version": "7.1",
            "ids": ",".join(map(str, work_item_ids[:200])),
            "$expand": "all"
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=self.headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("value", [])
                    else:
                        error_text = await response.text()
                        logger.error(f"Azure DevOps batch error {response.status}: {error_text}")
                        raise Exception(f"Azure DevOps batch error: {response.status}")
            except Exception as e:
                logger.error(f"Failed to fetch work items batch: {e}")
                raise
    
    def parse_work_item_to_requirement(self, work_item: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Azure DevOps work item to requirement format"""
        fields = work_item.get("fields", {})
        
        return {
            "source": "azure_devops",
            "source_ref": str(work_item.get("id", "")),
            "title": fields.get("System.Title", ""),
            "description": fields.get("System.Description", ""),
            "work_item_type": fields.get("System.WorkItemType", ""),
            "state": fields.get("System.State", ""),
            "assignee": fields.get("System.AssignedTo", {}).get("displayName", "") if fields.get("System.AssignedTo") else None,
            "created_at": fields.get("System.CreatedDate", ""),
            "updated_at": fields.get("System.ChangedDate", ""),
            "raw_payload": work_item
        }

