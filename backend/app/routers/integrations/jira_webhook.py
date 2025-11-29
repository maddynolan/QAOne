"""
Jira Two-Way Webhook Integration
Handles Jira webhooks to automatically trigger test plans when tickets change status.
"""

import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from typing import Dict, Any, Optional
from pydantic import BaseModel
import json

from app.services.integrations.jira_connector import get_jira_connector
from app.services.core.test_plan_service import get_test_plan_service
from app.services.automation.test_execution_service import get_test_execution_service
from app.decorators.audit import audit_log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/jira", tags=["integrations", "jira"])


class JiraWebhookPayload(BaseModel):
    """Jira webhook payload model"""
    webhookEvent: str
    issue: Optional[Dict[str, Any]] = None
    changelog: Optional[Dict[str, Any]] = None
    user: Optional[Dict[str, Any]] = None


@router.post("/webhook", summary="Jira webhook endpoint")
@audit_log_action(
    action="jira_webhook_received",
    resource_type="webhook",
    get_resource_id=lambda *args, **kwargs: kwargs.get("payload", {}).get("issue", {}).get("key", "unknown")
)
async def jira_webhook(
    request: Request,
    payload: Dict[str, Any]
):
    """
    Handle Jira webhook events.
    
    Triggers test plans automatically when:
    - Ticket status changes to "Ready for QA"
    - Ticket is assigned to QA team
    - Ticket transitions to "In Testing"
    
    Webhook payload structure:
    {
        "webhookEvent": "jira:issue_updated",
        "issue": {
            "key": "PROJ-123",
            "fields": {
                "status": {"name": "Ready for QA"},
                "summary": "Test feature X"
            }
        },
        "changelog": {
            "items": [{
                "field": "status",
                "fromString": "In Progress",
                "toString": "Ready for QA"
            }]
        }
    }
    """
    try:
        webhook_event = payload.get("webhookEvent", "")
        issue = payload.get("issue", {})
        changelog = payload.get("changelog", {})
        
        issue_key = issue.get("key", "")
        issue_fields = issue.get("fields", {})
        current_status = issue_fields.get("status", {}).get("name", "")
        
        logger.info(f"Received Jira webhook: {webhook_event} for issue {issue_key} with status {current_status}")
        
        # Check if status changed to "Ready for QA" or similar
        status_changed = False
        new_status = None
        
        if changelog:
            items = changelog.get("items", [])
            for item in items:
                if item.get("field") == "status":
                    from_status = item.get("fromString", "")
                    to_status = item.get("toString", "")
                    if to_status in ["Ready for QA", "QA Ready", "Ready for Testing", "In Testing"]:
                        status_changed = True
                        new_status = to_status
                        logger.info(f"Status changed from {from_status} to {to_status}")
        
        # Also check current status if no changelog
        if not status_changed and current_status in ["Ready for QA", "QA Ready", "Ready for Testing", "In Testing"]:
            status_changed = True
            new_status = current_status
        
        if status_changed:
            # Find linked test plan for this Jira issue
            jira_connector = get_jira_connector()
            test_plan_service = get_test_plan_service()
            test_execution_service = get_test_execution_service()
            
            # Search for test plans linked to this Jira issue
            # This assumes test plans have a jira_issue_key field
            test_plans = await test_plan_service.search_test_plans(
                filters={"jira_issue_key": issue_key}
            )
            
            if not test_plans:
                logger.warning(f"No test plans found linked to Jira issue {issue_key}")
                return {
                    "status": "success",
                    "message": f"No test plans linked to issue {issue_key}",
                    "issue_key": issue_key
                }
            
            # Trigger test execution for each linked test plan
            execution_results = []
            for test_plan in test_plans:
                try:
                    test_plan_id = test_plan.get("test_plan_id")
                    logger.info(f"Triggering test execution for test plan {test_plan_id} (linked to {issue_key})")
                    
                    # Create a test run for this plan
                    test_run = await test_execution_service.create_test_run(
                        test_plan_id=test_plan_id,
                        name=f"Auto-triggered from Jira {issue_key}",
                        environment="staging",  # Default environment
                        triggered_by="jira_webhook",
                        metadata={
                            "jira_issue_key": issue_key,
                            "jira_status": new_status,
                            "trigger_reason": "Status changed to Ready for QA"
                        }
                    )
                    
                    # Execute the test run
                    execution_result = await test_execution_service.execute_test_run(
                        test_run_id=test_run.get("test_run_id")
                    )
                    
                    execution_results.append({
                        "test_plan_id": test_plan_id,
                        "test_run_id": test_run.get("test_run_id"),
                        "status": execution_result.get("status", "unknown")
                    })
                    
                    logger.info(f"Test execution triggered for plan {test_plan_id}: {execution_result.get('status')}")
                    
                except Exception as e:
                    logger.error(f"Failed to trigger test execution for plan {test_plan.get('test_plan_id')}: {e}")
                    execution_results.append({
                        "test_plan_id": test_plan.get("test_plan_id"),
                        "status": "error",
                        "error": str(e)
                    })
            
            return {
                "status": "success",
                "message": f"Triggered {len(execution_results)} test execution(s) for issue {issue_key}",
                "issue_key": issue_key,
                "executions": execution_results
            }
        else:
            # Status change not relevant, just acknowledge
            return {
                "status": "acknowledged",
                "message": f"Webhook received for issue {issue_key}, no action required",
                "issue_key": issue_key,
                "current_status": current_status
            }
    
    except Exception as e:
        logger.error(f"Error processing Jira webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")


@router.get("/webhook/test", summary="Test webhook endpoint")
async def test_webhook():
    """Test endpoint to verify webhook is accessible"""
    return {
        "status": "ok",
        "message": "Jira webhook endpoint is accessible",
        "endpoint": "/integrations/jira/webhook"
    }

