"""
Confluence Connector - Integration with Confluence for documentation sync
Phase 2.1: Requirements Intelligence Agent
"""

import os
import logging
import aiohttp
from typing import Dict, List, Any, Optional
from datetime import datetime
import base64

logger = logging.getLogger(__name__)


class ConfluenceConnector:
    """
    Connector for Confluence API to sync documentation/requirements
    """
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        email: Optional[str] = None,
        api_token: Optional[str] = None
    ):
        self.base_url = base_url or os.getenv("CONFLUENCE_BASE_URL", "").rstrip("/")
        self.email = email or os.getenv("CONFLUENCE_EMAIL", "")
        self.api_token = api_token or os.getenv("CONFLUENCE_API_TOKEN", "")
        
        if not self.base_url or not self.email or not self.api_token:
            logger.warning("Confluence credentials not configured")
        
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
    
    async def get_page(self, page_id: str) -> Optional[Dict[str, Any]]:
        """Get a Confluence page by ID"""
        if not self.base_url:
            raise ValueError("Confluence not configured")
        
        url = f"{self.base_url}/rest/api/content/{page_id}?expand=body.storage,version"
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=self.headers) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"Confluence API error {response.status}: {error_text}")
                        raise Exception(f"Confluence API error: {response.status}")
            except Exception as e:
                logger.error(f"Failed to fetch Confluence page {page_id}: {e}")
                raise
    
    async def search_pages(
        self,
        space_key: Optional[str] = None,
        cql: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Search Confluence pages"""
        if not self.base_url:
            raise ValueError("Confluence not configured")
        
        if cql:
            url = f"{self.base_url}/rest/api/content/search"
            params = {"cql": cql, "limit": limit, "expand": "body.storage,version"}
        elif space_key:
            url = f"{self.base_url}/rest/api/content"
            params = {"spaceKey": space_key, "limit": limit, "expand": "body.storage,version"}
        else:
            raise ValueError("Either space_key or cql must be provided")
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=self.headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if "results" in data:
                            return data["results"]
                        return data if isinstance(data, list) else []
                    else:
                        error_text = await response.text()
                        logger.error(f"Confluence search error {response.status}: {error_text}")
                        raise Exception(f"Confluence search error: {response.status}")
            except Exception as e:
                logger.error(f"Failed to search Confluence pages: {e}")
                raise
    
    def parse_page_to_requirement(self, page: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Confluence page to requirement format"""
        body = page.get("body", {}).get("storage", {}).get("value", "")
        
        return {
            "source": "confluence",
            "source_ref": page.get("id", ""),
            "title": page.get("title", ""),
            "description": body,
            "space": page.get("space", {}).get("key", ""),
            "created_at": page.get("version", {}).get("when", ""),
            "updated_at": page.get("version", {}).get("when", ""),
            "raw_payload": page
        }

