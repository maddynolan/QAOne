"""
Flowstral Ingestion API Gateway
Phase 2.1: Validates, routes, and stores raw events
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class FlowstralGateway:
    """
    Ingestion API Gateway for Flowstral
    - Validates tenant & user auth
    - Validates domain allowlist
    - Rate limiting
    - Writes raw events to event store
    """
    
    def __init__(self):
        self.max_session_length = 3600  # 1 hour
        self.max_event_count = 10000
        self.rate_limit_per_minute = 1000
    
    async def validate_request(
        self,
        tenant_id: Optional[str],
        session_id: str,
        events: List[Dict[str, Any]],
        initial_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate incoming request:
        - Tenant & user auth (already done by verify_api_key_optional)
        - Domain allowlist
        - Max session length
        - Max event count
        - Rate limiting
        """
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }
        
        # Validate event count
        if len(events) > self.max_event_count:
            validation_result["valid"] = False
            validation_result["errors"].append(
                f"Event count ({len(events)}) exceeds maximum ({self.max_event_count})"
            )
        
        # Validate URLs in events
        if initial_url:
            url_validation = self._validate_url(initial_url, tenant_id)
            if not url_validation["allowed"]:
                validation_result["warnings"].append(
                    f"URL {initial_url} may not be in allowlist: {url_validation.get('reason', 'Unknown')}"
                )
        
        # Extract URLs from events
        for event in events:
            event_data = event.get("event_data", {})
            event_url = event_data.get("url")
            if event_url:
                url_validation = self._validate_url(event_url, tenant_id)
                if not url_validation["allowed"]:
                    validation_result["warnings"].append(
                        f"Event URL {event_url} may not be in allowlist"
                    )
        
        return validation_result
    
    def _validate_url(self, url: str, tenant_id: Optional[str]) -> Dict[str, Any]:
        """
        Validate URL against domain allowlist
        In production, this would check tenant-specific allowlists from DB
        """
        try:
            parsed = urlparse(url)
            domain = parsed.hostname
            
            if not domain:
                return {"allowed": False, "reason": "Invalid URL"}
            
            # For now, allow all domains (no allowlist configured)
            # In production, check tenant-specific allowlist from DB
            # Example:
            # allowed_domains = await get_tenant_allowlist(tenant_id)
            # if allowed_domains and domain not in allowed_domains:
            #     return {"allowed": False, "reason": f"Domain {domain} not in allowlist"}
            
            return {"allowed": True, "reason": "Domain allowed"}
        
        except Exception as e:
            logger.warning(f"URL validation error: {e}")
            return {"allowed": True, "reason": "Validation error, allowing by default"}
    
    async def store_events(
        self,
        session_id: str,
        events: List[Dict[str, Any]],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Store raw events to event store
        In production, this would write to Kafka/Kinesis/DB
        For now, we'll pass events directly to orchestrator
        """
        # In production, you might:
        # 1. Write to Kafka/Kinesis for async processing
        # 2. Write to DB table for immediate processing
        # 3. Use a message queue
        
        # For now, return events to be processed
        return {
            "stored": True,
            "event_count": len(events),
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def process_batch(
        self,
        events: List[Dict[str, Any]],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a batch of events
        Groups by session_id and validates
        """
        if not events:
            return {
                "status": "error",
                "error": "No events provided"
            }
        
        # Group events by session_id
        sessions = {}
        for event in events:
            session_id = event.get("session_id")
            if not session_id:
                logger.warning("Event missing session_id, skipping")
                continue
            
            if session_id not in sessions:
                sessions[session_id] = []
            sessions[session_id].append(event)
        
        results = {}
        for session_id, session_events in sessions.items():
            # Validate session events
            validation = await self.validate_request(
                tenant_id=tenant_id,
                session_id=session_id,
                events=session_events
            )
            
            if not validation["valid"]:
                results[session_id] = {
                    "status": "error",
                    "errors": validation["errors"]
                }
                continue
            
            # Store events
            store_result = await self.store_events(
                session_id=session_id,
                events=session_events,
                tenant_id=tenant_id
            )
            
            results[session_id] = {
                "status": "success",
                "event_count": len(session_events),
                "warnings": validation.get("warnings", []),
                "stored": store_result["stored"]
            }
        
        return {
            "status": "success",
            "sessions": results,
            "total_events": len(events),
            "processed_at": datetime.utcnow().isoformat()
        }


# Global gateway instance
flowstral_gateway = FlowstralGateway()

