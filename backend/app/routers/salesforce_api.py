"""
Salesforce Metadata Validation API

Endpoints for:
- Connecting to Salesforce
- Fetching metadata
- Validating objects, fields, selectors
- Workflow validation
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/salesforce", tags=["salesforce"])


# ============================================================================
# Request/Response Models
# ============================================================================

class SalesforceConnectionRequest(BaseModel):
    username: str
    password: str
    security_token: str = ""
    domain: str = "login"  # "login" for prod, "test" for sandbox


class SalesforceConnectionResponse(BaseModel):
    connected: bool
    instance_url: Optional[str] = None
    error: Optional[str] = None


class FetchMetadataRequest(BaseModel):
    objects: Optional[List[str]] = None  # If None, fetches common objects


class ValidateObjectRequest(BaseModel):
    object_name: str


class ValidateFieldRequest(BaseModel):
    object_name: str
    field_name: str


class ValidatePicklistRequest(BaseModel):
    object_name: str
    field_name: str
    value: str


class ValidateSelectorRequest(BaseModel):
    selector: str


class ValidateWorkflowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    app_type: str = "salesforce"


class FieldSuggestionRequest(BaseModel):
    object_name: str
    partial: str
    limit: int = 10


class ObjectSuggestionRequest(BaseModel):
    partial: str
    limit: int = 10


# ============================================================================
# Connection Endpoints
# ============================================================================

@router.get("/status")
async def get_connection_status():
    """
    Get Salesforce connection and cache status.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.get_cache_status()


@router.post("/connect", response_model=SalesforceConnectionResponse)
async def connect_to_salesforce(request: SalesforceConnectionRequest):
    """
    Connect to a Salesforce org.
    
    Stores credentials in environment for session.
    """
    import os
    
    # Set environment variables for this session
    os.environ["SF_USERNAME"] = request.username
    os.environ["SF_PASSWORD"] = request.password
    os.environ["SF_SECURITY_TOKEN"] = request.security_token
    os.environ["SF_DOMAIN"] = request.domain
    
    from app.services.salesforce.metadata_service import get_metadata_service
    
    # Re-create service to pick up new credentials
    service = get_metadata_service()
    service._sf_client = None  # Force reconnect
    
    if service.is_connected():
        return SalesforceConnectionResponse(
            connected=True,
            instance_url=service.instance_url
        )
    else:
        return SalesforceConnectionResponse(
            connected=False,
            error="Failed to connect to Salesforce. Check credentials."
        )


@router.post("/disconnect")
async def disconnect_from_salesforce():
    """
    Disconnect from Salesforce org.
    """
    import os
    
    # Clear environment variables
    for key in ["SF_USERNAME", "SF_PASSWORD", "SF_SECURITY_TOKEN"]:
        if key in os.environ:
            del os.environ[key]
    
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._sf_client = None
    service.connected = False
    
    return {"disconnected": True}


# ============================================================================
# Metadata Endpoints
# ============================================================================

@router.post("/metadata/fetch")
async def fetch_metadata(
    request: FetchMetadataRequest,
    background_tasks: BackgroundTasks
):
    """
    Fetch metadata from Salesforce org.
    
    This is a potentially long-running operation, so it can run in background.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    
    if not service.is_connected():
        raise HTTPException(
            status_code=400,
            detail="Not connected to Salesforce. Call /connect first."
        )
    
    # Fetch synchronously for now (could be background task)
    result = await service.fetch_org_metadata(request.objects)
    
    return result


@router.get("/metadata/objects")
async def list_cached_objects():
    """
    List all objects in the metadata cache.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._load_cache()
    
    objects = []
    for obj_name, obj_data in service._objects_cache.items():
        objects.append({
            "name": obj_name,
            "label": obj_data.get("label", obj_name),
            "custom": obj_data.get("custom", obj_name.endswith("__c")),
            "fields_count": len(obj_data.get("fields", {})),
            "record_types_count": len(obj_data.get("record_types", []))
        })
    
    return {
        "objects": objects,
        "total": len(objects)
    }


@router.get("/metadata/objects/{object_name}")
async def get_object_metadata(object_name: str):
    """
    Get detailed metadata for a specific object.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._load_cache()
    
    if object_name not in service._objects_cache:
        raise HTTPException(
            status_code=404,
            detail=f"Object '{object_name}' not in cache. Fetch metadata first."
        )
    
    return service._objects_cache[object_name]


@router.get("/metadata/objects/{object_name}/fields")
async def get_object_fields(object_name: str):
    """
    Get all fields for a specific object.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._load_cache()
    
    if object_name not in service._fields_cache:
        # Return standard fields as fallback
        from app.services.salesforce.metadata_service import STANDARD_FIELDS
        return {
            "object": object_name,
            "fields": [{"name": f, "label": f, "type": "unknown"} for f in STANDARD_FIELDS],
            "cached": False
        }
    
    fields = []
    for name, data in service._fields_cache[object_name].items():
        fields.append({
            "name": name,
            "label": data.get("label", name),
            "type": data.get("type", "unknown"),
            "required": data.get("required", False),
            "custom": data.get("custom", name.endswith("__c")),
            "picklist": bool(data.get("picklistValues"))
        })
    
    return {
        "object": object_name,
        "fields": fields,
        "cached": True
    }


# ============================================================================
# Validation Endpoints
# ============================================================================

@router.post("/validate/object")
async def validate_object(request: ValidateObjectRequest):
    """
    Validate a Salesforce object API name.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_object(request.object_name)


@router.post("/validate/field")
async def validate_field(request: ValidateFieldRequest):
    """
    Validate a field API name for a given object.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_field(request.object_name, request.field_name)


@router.post("/validate/picklist")
async def validate_picklist(request: ValidatePicklistRequest):
    """
    Validate a picklist value.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_picklist_value(
        request.object_name,
        request.field_name,
        request.value
    )


@router.post("/validate/selector")
async def validate_selector(request: ValidateSelectorRequest):
    """
    Validate a Salesforce selector pattern.
    
    Extracts and validates field/object references from the selector.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_selector(request.selector)


@router.post("/validate/workflow")
async def validate_workflow(request: ValidateWorkflowRequest):
    """
    Validate an entire workflow for Salesforce metadata.
    
    Returns comprehensive validation report including:
    - Per-step validation
    - Field/object references
    - Invalid selectors
    - Suggestions for fixes
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    
    workflow = {
        "nodes": request.nodes,
        "app_type": request.app_type
    }
    
    return service.validate_workflow(workflow)


# ============================================================================
# Autocomplete Endpoints
# ============================================================================

@router.post("/suggest/fields")
async def suggest_fields(request: FieldSuggestionRequest):
    """
    Get field suggestions for autocomplete.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    suggestions = service.get_field_suggestions(
        request.object_name,
        request.partial,
        request.limit
    )
    
    return {"suggestions": suggestions}


@router.post("/suggest/objects")
async def suggest_objects(request: ObjectSuggestionRequest):
    """
    Get object suggestions for autocomplete.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    suggestions = service.get_object_suggestions(
        request.partial,
        request.limit
    )
    
    return {"suggestions": suggestions}


# ============================================================================
# SOQL Endpoints
# ============================================================================

class SOQLQueryRequest(BaseModel):
    query: str
    parameters: Optional[Dict[str, Any]] = None


class SOQLAssertionRequest(BaseModel):
    query: str
    expected_count: int
    parameters: Optional[Dict[str, Any]] = None


@router.post("/soql/query")
async def execute_soql_query(request: SOQLQueryRequest):
    """
    Execute a SOQL query against the connected Salesforce org.
    """
    from app.services.salesforce.soql_service import get_soql_service
    
    service = get_soql_service()
    return await service.execute_query(request.query, request.parameters)


@router.post("/soql/assert")
async def execute_soql_assertion(request: SOQLAssertionRequest):
    """
    Execute a SOQL query and validate record count for test assertions.
    """
    from app.services.salesforce.soql_service import get_soql_service
    
    service = get_soql_service()
    return await service.validate_assertion(
        request.query,
        request.expected_count,
        request.parameters
    )


@router.post("/soql/generate-code")
async def generate_soql_code(request: SOQLAssertionRequest):
    """
    Generate assertion code for a SOQL query.
    """
    from app.services.salesforce.soql_service import get_soql_service
    
    service = get_soql_service()
    
    return {
        "python": service.generate_assertion_code(request.query, request.expected_count, "python"),
        "java": service.generate_assertion_code(request.query, request.expected_count, "java"),
        "typescript": service.generate_assertion_code(request.query, request.expected_count, "typescript")
    }
