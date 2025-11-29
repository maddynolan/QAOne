"""
Audit Decorator
Automatically logs all actions to audit_logs table for compliance and traceability.
"""

import logging
from typing import Optional, Callable, Dict, Any
from functools import wraps
from fastapi import Request, HTTPException
from datetime import datetime

from app.services.core.observability_service import observability_service
from app.middleware.tenant_middleware import get_tenant_id, get_user_id

logger = logging.getLogger(__name__)


def audit(
    action: str,
    resource_type: str,
    resource_id_param: Optional[str] = None,
    details_func: Optional[Callable] = None
):
    """
    Decorator to automatically audit an action.
    
    Args:
        action: Action name (e.g., "create", "update", "delete", "execute")
        resource_type: Type of resource (e.g., "test_case", "test_run", "defect")
        resource_id_param: Parameter name containing resource ID (e.g., "test_case_id")
        details_func: Optional function to extract additional details from request/response
    
    Usage:
        @router.post("/test-cases")
        @audit(action="create", resource_type="test_case")
        async def create_test_case(request: Request, ...):
            ...
        
        @router.delete("/test-cases/{test_case_id}")
        @audit(action="delete", resource_type="test_case", resource_id_param="test_case_id")
        async def delete_test_case(request: Request, test_case_id: str, ...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find request object
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")
            
            # Get context
            tenant_id = get_tenant_id(request) if request else None
            user_id = get_user_id(request) if request else None
            
            # Extract resource ID
            resource_id = None
            if resource_id_param:
                resource_id = kwargs.get(resource_id_param) or (
                    args[list(kwargs.keys()).index(resource_id_param)] if resource_id_param in kwargs else None
                )
            
            # Extract additional details
            details = {}
            if details_func:
                try:
                    details = details_func(request, *args, **kwargs) or {}
                except Exception as e:
                    logger.warning(f"Error extracting audit details: {e}")
            
            # Add request metadata
            if request:
                details["method"] = request.method
                details["path"] = request.url.path
                details["ip_address"] = request.client.host if request.client else None
                details["user_agent"] = request.headers.get("user-agent")
            
            # Log audit event (fire and forget - don't block request)
            try:
                await observability_service.log_audit_event(
                    action=action,
                    resource_type=resource_type,
                    resource_id=str(resource_id) if resource_id else None,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    details=details,
                    ip_address=details.get("ip_address"),
                    user_agent=details.get("user_agent")
                )
            except Exception as e:
                # Don't fail the request if audit logging fails
                logger.error(f"Failed to log audit event: {e}")
            
            # Execute the function
            try:
                result = await func(*args, **kwargs)
                
                # Log success in details if result available
                if result and isinstance(result, dict):
                    try:
                        await observability_service.log_audit_event(
                            action=f"{action}_success",
                            resource_type=resource_type,
                            resource_id=str(resource_id) if resource_id else None,
                            user_id=user_id,
                            tenant_id=tenant_id,
                            details={"result": "success", **details}
                        )
                    except Exception:
                        pass  # Ignore audit errors
                
                return result
            except Exception as e:
                # Log failure
                try:
                    await observability_service.log_audit_event(
                        action=f"{action}_failed",
                        resource_type=resource_type,
                        resource_id=str(resource_id) if resource_id else None,
                        user_id=user_id,
                        tenant_id=tenant_id,
                        details={"error": str(e), **details}
                    )
                except Exception:
                    pass
                
                raise
        
        return wrapper
    return decorator


def audit_ai_decision(
    resource_type: str,
    resource_id_param: Optional[str] = None
):
    """
    Special decorator for AI-generated decisions.
    Logs the AI model, prompt, response, and reasoning.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")
            
            tenant_id = get_tenant_id(request) if request else None
            user_id = get_user_id(request) if request else None
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Extract AI decision details from result
            ai_details = {}
            if isinstance(result, dict):
                ai_details = {
                    "model": result.get("model"),
                    "prompt_tokens": result.get("prompt_tokens"),
                    "completion_tokens": result.get("completion_tokens"),
                    "reasoning": result.get("reasoning"),
                }
            
            # Log AI decision
            try:
                await observability_service.log_audit_event(
                    action="ai_decision",
                    resource_type=resource_type,
                    resource_id=kwargs.get(resource_id_param) if resource_id_param else None,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    details=ai_details
                )
            except Exception as e:
                logger.error(f"Failed to log AI decision: {e}")
            
            return result
        
        return wrapper
    return decorator

