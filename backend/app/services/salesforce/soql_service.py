"""
SOQL Query Service for Salesforce Backend Assertions
Allows executing SOQL queries for data verification during tests.
"""

import logging
import os
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SOQLService:
    """
    Service to execute SOQL queries against Salesforce.
    Supports both Workbench-style queries and Simple Salesforce integration.
    """
    
    def __init__(self):
        self._sf_client = None
        self.connected = False
        self.instance_url = None
        
    def _get_salesforce_client(self):
        """Lazy load Salesforce client"""
        if self._sf_client is None:
            try:
                from simple_salesforce import Salesforce
                
                # Try environment variables
                username = os.getenv("SF_USERNAME")
                password = os.getenv("SF_PASSWORD")
                security_token = os.getenv("SF_SECURITY_TOKEN", "")
                domain = os.getenv("SF_DOMAIN", "login")  # 'login' for prod, 'test' for sandbox
                
                if username and password:
                    self._sf_client = Salesforce(
                        username=username,
                        password=password,
                        security_token=security_token,
                        domain=domain
                    )
                    self.connected = True
                    self.instance_url = self._sf_client.sf_instance
                    logger.info(f"Connected to Salesforce: {self.instance_url}")
                else:
                    logger.warning("Salesforce credentials not configured. Set SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN")
                    
            except ImportError:
                logger.warning("simple_salesforce not installed. Run: pip install simple-salesforce")
            except Exception as e:
                logger.error(f"Failed to connect to Salesforce: {e}")
                
        return self._sf_client
    
    def is_available(self) -> bool:
        """Check if Salesforce connection is available"""
        client = self._get_salesforce_client()
        return client is not None and self.connected
    
    async def execute_query(
        self,
        query: str,
        parameters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Execute a SOQL query.
        
        Args:
            query: SOQL query string (can contain {param} placeholders)
            parameters: Dictionary of parameter values to substitute
            
        Returns:
            Dict with query results or error
        """
        try:
            client = self._get_salesforce_client()
            
            if not client:
                return {
                    "success": False,
                    "error": "Salesforce not connected. Configure SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN in .env",
                    "mock_mode": True
                }
            
            # Substitute parameters
            if parameters:
                for key, value in parameters.items():
                    placeholder = f"{{{key}}}"
                    if placeholder in query:
                        # Escape single quotes in string values
                        if isinstance(value, str):
                            value = value.replace("'", "\\'")
                        query = query.replace(placeholder, str(value))
            
            # Execute query
            result = client.query(query)
            
            return {
                "success": True,
                "totalSize": result.get("totalSize", 0),
                "records": result.get("records", []),
                "done": result.get("done", True),
                "query": query,
                "executed_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"SOQL query failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "query": query
            }
    
    async def validate_assertion(
        self,
        query: str,
        expected_count: int,
        parameters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Execute SOQL query and validate record count for assertions.
        
        Args:
            query: SOQL query string
            expected_count: Expected number of records (use 0 for "no records", 1+ for "at least N")
            parameters: Query parameters
            
        Returns:
            Dict with assertion result
        """
        result = await self.execute_query(query, parameters)
        
        if not result.get("success"):
            return {
                "passed": False,
                "error": result.get("error"),
                "assertion_type": "soql_query"
            }
        
        actual_count = result.get("totalSize", 0)
        passed = actual_count >= expected_count if expected_count > 0 else actual_count == 0
        
        return {
            "passed": passed,
            "expected_count": expected_count,
            "actual_count": actual_count,
            "records": result.get("records", [])[:5],  # Return first 5 records for debugging
            "query": result.get("query"),
            "assertion_type": "soql_query",
            "message": f"Expected {'at least ' if expected_count > 0 else ''}{expected_count} record(s), found {actual_count}"
        }
    
    def generate_assertion_code(
        self,
        query: str,
        expected_count: int,
        language: str = "python"
    ) -> str:
        """
        Generate assertion code for the given SOQL query.
        
        Args:
            query: SOQL query string
            expected_count: Expected record count
            language: Target language (python, java, typescript)
            
        Returns:
            Code snippet for the assertion
        """
        escaped_query = query.replace('"', '\\"').replace("'", "\\'")
        
        if language == "python":
            return f'''
# SOQL Assertion
# Requires: pip install simple-salesforce
from simple_salesforce import Salesforce

def verify_salesforce_data(sf_client):
    query = "{escaped_query}"
    result = sf_client.query(query)
    actual_count = result.get("totalSize", 0)
    assert actual_count >= {expected_count}, f"Expected at least {expected_count} record(s), found {{actual_count}}"
    return result.get("records", [])
'''
        elif language == "java":
            return f'''
// SOQL Assertion
// Requires: Salesforce REST API client
String query = "{escaped_query}";
QueryResult result = connection.query(query);
int actualCount = result.getTotalSize();
assertTrue("Expected at least {expected_count} record(s), found " + actualCount, 
    actualCount >= {expected_count});
'''
        elif language == "typescript":
            return f'''
// SOQL Assertion
// Requires: jsforce or sf-api-client
const query = "{escaped_query}";
const result = await connection.query(query);
const actualCount = result.totalSize;
expect(actualCount).toBeGreaterThanOrEqual({expected_count});
'''
        
        return f"// SOQL Query: {query}\n// Expected: {expected_count}+ records"


# Singleton instance
_soql_service = None

def get_soql_service() -> SOQLService:
    """Get or create the SOQL service singleton"""
    global _soql_service
    if _soql_service is None:
        _soql_service = SOQLService()
    return _soql_service

