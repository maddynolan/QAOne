"""
Test Healer - Self-Healing Test Automation
Automatically tries alternative identifiers when selectors fail
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.flowstral.element_model_service import get_element_model_service
from app.services.automation.application_detector import ApplicationType

logger = logging.getLogger(__name__)


class TestHealer:
    """
    Self-healing test automation service.
    
    When a test fails due to selector issues:
    1. Detects the failure
    2. Retrieves element model
    3. Tries next identifier in priority order
    4. Records success/failure for analytics
    5. Auto-updates test if healing succeeds
    """
    
    def __init__(self):
        self.element_model_service = get_element_model_service()
    
    async def heal_failed_action(
        self,
        element_model_id: str,
        failed_locator: str,
        error_message: str,
        application_type: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Attempt to heal a failed test action by trying alternative identifiers.
        
        Args:
            element_model_id: Element model ID
            failed_locator: The locator that failed
            error_message: Error message from the failure
            application_type: Application type (for filtering identifiers)
            
        Returns:
            Dictionary with healing result:
            {
                "healed": True/False,
                "new_locator": "...",
                "identifier_used": "...",
                "identifier_index": 0,
                "attempts": 1
            }
        """
        try:
            # Get element model
            element_model = await self.element_model_service.get_element_model(element_model_id)
            if not element_model:
                logger.warning(f"[HEALER] Element model {element_model_id} not found")
                return None
            
            identifiers = element_model.get("identifiers", [])
            if not identifiers:
                logger.warning(f"[HEALER] No identifiers available for element {element_model_id}")
                return None
            
            app_type = application_type or element_model.get("application_type", "generic")
            
            # Filter identifiers by app type
            app_identifiers = [
                id for id in identifiers
                if not id.get("app_specific", False) or id.get("app_type") == app_type
            ]
            
            if not app_identifiers:
                app_identifiers = identifiers
            
            # Sort by priority
            app_identifiers.sort(key=lambda x: (
                x.get("priority", 999),
                -x.get("confidence", 0.0)
            ))
            
            # Find the failed locator in the list
            failed_index = None
            for idx, identifier in enumerate(app_identifiers):
                if identifier.get("playwright_locator") == failed_locator:
                    failed_index = idx
                    break
            
            # Try next identifier
            if failed_index is not None and failed_index < len(app_identifiers) - 1:
                next_identifier = app_identifiers[failed_index + 1]
                new_locator = next_identifier.get("playwright_locator")
                
                if new_locator:
                    logger.info(f"[HEALER] ✅ Found alternative identifier: {next_identifier.get('type')} (priority: {next_identifier.get('priority')})")
                    
                    # Record the failure for analytics
                    await self.element_model_service.record_usage(
                        element_id=element_model_id,
                        identifier_used=next_identifier.get("type", "unknown"),
                        identifier_index=failed_index + 1,
                        success=False,  # This attempt failed, trying next
                        error_message=error_message
                    )
                    
                    return {
                        "healed": True,
                        "new_locator": new_locator,
                        "identifier_used": next_identifier.get("type", "unknown"),
                        "identifier_index": failed_index + 1,
                        "attempts": 1,
                        "confidence": next_identifier.get("confidence", 0.0)
                    }
            else:
                logger.warning(f"[HEALER] No more identifiers to try for element {element_model_id}")
                return {
                    "healed": False,
                    "reason": "No more identifiers available",
                    "attempts": 0
                }
        
        except Exception as e:
            logger.error(f"[HEALER] Failed to heal element {element_model_id}: {e}", exc_info=True)
            return None
    
    async def record_success(
        self,
        element_model_id: str,
        identifier_type: str,
        identifier_index: int,
        execution_time_ms: Optional[int] = None
    ) -> None:
        """
        Record successful identifier usage for analytics.
        This helps track which identifiers work best.
        """
        try:
            await self.element_model_service.record_usage(
                element_id=element_model_id,
                identifier_used=identifier_type,
                identifier_index=identifier_index,
                success=True,
                execution_time_ms=execution_time_ms
            )
        except Exception as e:
            logger.warning(f"[HEALER] Failed to record success: {e}")
    
    async def get_all_identifiers(
        self,
        element_model_id: str,
        application_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all identifiers for an element model, sorted by priority.
        Useful for generating fallback chains in test scripts.
        """
        try:
            element_model = await self.element_model_service.get_element_model(element_model_id)
            if not element_model:
                return []
            
            identifiers = element_model.get("identifiers", [])
            app_type = application_type or element_model.get("application_type", "generic")
            
            # Filter by app type
            app_identifiers = [
                id for id in identifiers
                if not id.get("app_specific", False) or id.get("app_type") == app_type
            ]
            
            if not app_identifiers:
                app_identifiers = identifiers
            
            # Sort by priority
            app_identifiers.sort(key=lambda x: (
                x.get("priority", 999),
                -x.get("confidence", 0.0)
            ))
            
            return app_identifiers
        
        except Exception as e:
            logger.error(f"[HEALER] Failed to get identifiers: {e}", exc_info=True)
            return []


# Global instance
_test_healer = None

def get_test_healer() -> TestHealer:
    """Get or create global TestHealer instance"""
    global _test_healer
    if _test_healer is None:
        _test_healer = TestHealer()
    return _test_healer



