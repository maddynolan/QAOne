"""
Salesforce Metadata Validation Service

Validates test steps against Salesforce org metadata:
- Object API names (Account, Contact, Custom__c)
- Field API names (Email, Custom_Field__c)
- Picklist values
- Record Types
- Lightning Component patterns
- Selector validity
"""

import logging
import os
import re
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path

logger = logging.getLogger(__name__)


# Common Salesforce standard objects
STANDARD_OBJECTS = {
    'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event',
    'Campaign', 'Contract', 'Order', 'Product2', 'Pricebook2', 'PricebookEntry',
    'Quote', 'QuoteLineItem', 'Asset', 'ContentDocument', 'ContentVersion',
    'Attachment', 'Note', 'User', 'Group', 'Profile', 'PermissionSet',
    'RecordType', 'BusinessHours', 'EmailTemplate', 'Folder', 'Report',
    'Dashboard', 'Document', 'Solution', 'CaseComment', 'FeedItem', 'FeedComment'
}

# Common standard fields across objects
STANDARD_FIELDS = {
    'Id', 'Name', 'OwnerId', 'CreatedById', 'CreatedDate', 'LastModifiedById',
    'LastModifiedDate', 'SystemModstamp', 'IsDeleted', 'RecordTypeId',
    'Description', 'Email', 'Phone', 'Fax', 'Website', 'Industry', 'Type',
    'Status', 'Priority', 'Subject', 'Body', 'Title', 'FirstName', 'LastName',
    'MailingStreet', 'MailingCity', 'MailingState', 'MailingPostalCode',
    'MailingCountry', 'BillingStreet', 'BillingCity', 'BillingState',
    'BillingPostalCode', 'BillingCountry', 'ShippingStreet', 'ShippingCity',
    'ShippingState', 'ShippingPostalCode', 'ShippingCountry', 'AccountId',
    'ContactId', 'LeadId', 'OpportunityId', 'CaseId', 'CampaignId',
    'Amount', 'Probability', 'CloseDate', 'StageName', 'IsClosed', 'IsWon',
    'LeadSource', 'Rating', 'AnnualRevenue', 'NumberOfEmployees'
}

# Lightning component patterns
LIGHTNING_PATTERNS = {
    'lightning-input': ['label', 'value', 'name', 'type', 'placeholder', 'required', 'disabled'],
    'lightning-button': ['label', 'name', 'variant', 'disabled', 'icon-name'],
    'lightning-combobox': ['label', 'value', 'options', 'name', 'placeholder'],
    'lightning-textarea': ['label', 'value', 'name', 'placeholder', 'maxlength'],
    'lightning-checkbox': ['label', 'checked', 'name', 'disabled'],
    'lightning-datepicker': ['label', 'value', 'name', 'min', 'max'],
    'lightning-record-form': ['record-id', 'object-api-name', 'fields', 'mode'],
    'lightning-record-edit-form': ['record-id', 'object-api-name'],
    'lightning-record-view-form': ['record-id', 'object-api-name'],
    'lightning-output-field': ['field-name', 'value'],
    'lightning-input-field': ['field-name', 'value', 'required'],
    'lightning-formatted-text': ['value'],
    'lightning-formatted-number': ['value', 'format-style'],
    'lightning-formatted-date-time': ['value'],
    'lightning-icon': ['icon-name', 'size', 'variant'],
    'lightning-badge': ['label'],
    'lightning-card': ['title', 'icon-name'],
    'lightning-tabset': [],
    'lightning-tab': ['label', 'value'],
    'lightning-accordion': [],
    'lightning-accordion-section': ['name', 'label'],
    'lightning-datatable': ['data', 'columns', 'key-field'],
    'lightning-tree': ['items'],
    'lightning-file-upload': ['label', 'name', 'accept', 'multiple'],
}

# Salesforce selector patterns for validation
SF_SELECTOR_PATTERNS = {
    'data-id': r'\[data-id=["\']([^"\']+)["\']\]',
    'data-field': r'\[data-field=["\']([^"\']+)["\']\]',
    'data-target-selection-name': r'\[data-target-selection-name=["\']([^"\']+)["\']\]',
    'lightning-component': r'lightning-[\w-]+',
    'lwc-component': r'c-[\w-]+|my-[\w-]+',
    'aura-id': r'\[aura:id=["\']([^"\']+)["\']\]',
    'record-id': r'[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}',
    'custom-field': r'(\w+__c)',
    'custom-object': r'(\w+__c)(?:\.|$)',
    'lookup-field': r'(\w+)(?:Id|__c)$',
}


class SalesforceMetadataService:
    """
    Service to validate test steps against Salesforce org metadata.
    Supports caching and offline validation using cached metadata.
    """
    
    def __init__(self, cache_dir: str = None):
        self._sf_client = None
        self.connected = False
        self.instance_url = None
        self.cache_dir = Path(cache_dir) if cache_dir else Path(__file__).parent / "metadata_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # In-memory cache
        self._objects_cache: Dict[str, Dict] = {}
        self._fields_cache: Dict[str, Dict[str, Dict]] = {}  # object -> field -> metadata
        self._picklists_cache: Dict[str, Dict[str, List[str]]] = {}  # object -> field -> values
        self._record_types_cache: Dict[str, List[Dict]] = {}  # object -> record types
        self._cache_loaded = False
        self._cache_timestamp: Optional[datetime] = None
        
    def _get_salesforce_client(self):
        """Lazy load Salesforce client"""
        if self._sf_client is None:
            try:
                from simple_salesforce import Salesforce
                
                username = os.getenv("SF_USERNAME")
                password = os.getenv("SF_PASSWORD")
                security_token = os.getenv("SF_SECURITY_TOKEN", "")
                domain = os.getenv("SF_DOMAIN", "login")
                
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
                    logger.warning("Salesforce credentials not configured")
                    
            except ImportError:
                logger.warning("simple_salesforce not installed")
            except Exception as e:
                logger.error(f"Failed to connect to Salesforce: {e}")
                
        return self._sf_client
    
    def is_connected(self) -> bool:
        """Check if connected to Salesforce"""
        return self._get_salesforce_client() is not None
    
    # =========================================================================
    # Metadata Fetching
    # =========================================================================
    
    async def fetch_org_metadata(self, objects: List[str] = None) -> Dict[str, Any]:
        """
        Fetch metadata from Salesforce org.
        
        Args:
            objects: List of object API names to fetch. If None, fetches common objects.
            
        Returns:
            Dict with fetched metadata
        """
        client = self._get_salesforce_client()
        
        if not client:
            return {
                "success": False,
                "error": "Not connected to Salesforce",
                "cached": self._cache_loaded
            }
        
        try:
            results = {
                "objects": {},
                "fetched_at": datetime.now().isoformat(),
                "instance_url": self.instance_url
            }
            
            # Default objects to fetch
            if objects is None:
                objects = list(STANDARD_OBJECTS)[:20]  # Limit for performance
            
            for obj_name in objects:
                try:
                    # Describe the object
                    obj_describe = getattr(client, obj_name).describe()
                    
                    obj_data = {
                        "name": obj_describe["name"],
                        "label": obj_describe["label"],
                        "custom": obj_describe.get("custom", False),
                        "fields": {},
                        "record_types": []
                    }
                    
                    # Process fields
                    for field in obj_describe.get("fields", []):
                        field_data = {
                            "name": field["name"],
                            "label": field["label"],
                            "type": field["type"],
                            "custom": field.get("custom", False),
                            "required": not field.get("nillable", True),
                            "updateable": field.get("updateable", True),
                            "picklistValues": []
                        }
                        
                        # Get picklist values
                        if field["type"] == "picklist" or field["type"] == "multipicklist":
                            field_data["picklistValues"] = [
                                {"value": pv["value"], "label": pv["label"], "active": pv.get("active", True)}
                                for pv in field.get("picklistValues", [])
                            ]
                        
                        obj_data["fields"][field["name"]] = field_data
                    
                    # Get record types
                    for rt in obj_describe.get("recordTypeInfos", []):
                        if rt.get("available", True):
                            obj_data["record_types"].append({
                                "id": rt["recordTypeId"],
                                "name": rt["name"],
                                "developer_name": rt.get("developerName", rt["name"]),
                                "default": rt.get("defaultRecordTypeMapping", False)
                            })
                    
                    results["objects"][obj_name] = obj_data
                    self._objects_cache[obj_name] = obj_data
                    self._fields_cache[obj_name] = obj_data["fields"]
                    
                except Exception as e:
                    logger.warning(f"Failed to describe {obj_name}: {e}")
            
            # Save to cache file
            self._save_cache(results)
            self._cache_loaded = True
            self._cache_timestamp = datetime.now()
            
            return {
                "success": True,
                "objects_fetched": len(results["objects"]),
                "instance_url": self.instance_url,
                "cached": True
            }
            
        except Exception as e:
            logger.error(f"Failed to fetch metadata: {e}")
            return {"success": False, "error": str(e)}
    
    def _save_cache(self, data: Dict):
        """Save metadata to cache file"""
        cache_file = self.cache_dir / "sf_metadata.json"
        try:
            with open(cache_file, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved metadata cache to {cache_file}")
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")
    
    def _load_cache(self) -> bool:
        """Load metadata from cache file"""
        if self._cache_loaded:
            return True
            
        cache_file = self.cache_dir / "sf_metadata.json"
        
        if not cache_file.exists():
            return False
        
        try:
            with open(cache_file, 'r') as f:
                data = json.load(f)
            
            for obj_name, obj_data in data.get("objects", {}).items():
                self._objects_cache[obj_name] = obj_data
                self._fields_cache[obj_name] = obj_data.get("fields", {})
                
                # Build picklist cache
                self._picklists_cache[obj_name] = {}
                for field_name, field_data in obj_data.get("fields", {}).items():
                    if field_data.get("picklistValues"):
                        self._picklists_cache[obj_name][field_name] = [
                            pv["value"] for pv in field_data["picklistValues"]
                            if pv.get("active", True)
                        ]
                
                # Build record type cache
                self._record_types_cache[obj_name] = obj_data.get("record_types", [])
            
            self._cache_loaded = True
            self._cache_timestamp = datetime.fromisoformat(data.get("fetched_at", datetime.now().isoformat()))
            logger.info(f"Loaded metadata cache with {len(self._objects_cache)} objects")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load cache: {e}")
            return False
    
    # =========================================================================
    # Validation Methods
    # =========================================================================
    
    def validate_object(self, object_name: str) -> Dict[str, Any]:
        """
        Validate a Salesforce object API name.
        
        Returns:
            {
                "valid": bool,
                "object_name": str,
                "label": str (if valid),
                "custom": bool,
                "suggestions": List[str] (if invalid),
                "message": str
            }
        """
        self._load_cache()
        
        # Normalize name
        normalized = object_name.strip()
        
        # Check if it's a standard object
        if normalized in STANDARD_OBJECTS:
            cached = self._objects_cache.get(normalized, {})
            return {
                "valid": True,
                "object_name": normalized,
                "label": cached.get("label", normalized),
                "custom": False,
                "message": f"Standard object: {normalized}"
            }
        
        # Check if it's in cache
        if normalized in self._objects_cache:
            obj = self._objects_cache[normalized]
            return {
                "valid": True,
                "object_name": normalized,
                "label": obj.get("label", normalized),
                "custom": obj.get("custom", normalized.endswith("__c")),
                "message": f"Valid object: {normalized}"
            }
        
        # Check custom object pattern
        if normalized.endswith("__c"):
            # Could be valid, but not in cache
            suggestions = self._find_similar_names(normalized, list(self._objects_cache.keys()) + list(STANDARD_OBJECTS))
            return {
                "valid": False,
                "object_name": normalized,
                "custom": True,
                "suggestions": suggestions,
                "warning": True,
                "message": f"Custom object '{normalized}' not found in metadata cache. May need to refresh metadata."
            }
        
        # Invalid - find suggestions
        all_objects = list(self._objects_cache.keys()) + list(STANDARD_OBJECTS)
        suggestions = self._find_similar_names(normalized, all_objects)
        
        return {
            "valid": False,
            "object_name": normalized,
            "suggestions": suggestions,
            "message": f"Invalid object name: '{normalized}'"
        }
    
    def validate_field(self, object_name: str, field_name: str) -> Dict[str, Any]:
        """
        Validate a field API name for a given object.
        
        Returns:
            {
                "valid": bool,
                "field_name": str,
                "label": str (if valid),
                "type": str (if valid),
                "required": bool,
                "custom": bool,
                "suggestions": List[str] (if invalid)
            }
        """
        self._load_cache()
        
        normalized_field = field_name.strip()
        normalized_obj = object_name.strip()
        
        # Check standard fields first
        if normalized_field in STANDARD_FIELDS:
            cached = self._fields_cache.get(normalized_obj, {}).get(normalized_field, {})
            return {
                "valid": True,
                "field_name": normalized_field,
                "object_name": normalized_obj,
                "label": cached.get("label", normalized_field),
                "type": cached.get("type", "unknown"),
                "required": cached.get("required", False),
                "custom": False,
                "message": f"Standard field: {normalized_field}"
            }
        
        # Check cache
        if normalized_obj in self._fields_cache:
            fields = self._fields_cache[normalized_obj]
            
            if normalized_field in fields:
                field = fields[normalized_field]
                return {
                    "valid": True,
                    "field_name": normalized_field,
                    "object_name": normalized_obj,
                    "label": field.get("label", normalized_field),
                    "type": field.get("type", "unknown"),
                    "required": field.get("required", False),
                    "custom": field.get("custom", normalized_field.endswith("__c")),
                    "message": f"Valid field: {normalized_obj}.{normalized_field}"
                }
            
            # Field not found - find suggestions
            suggestions = self._find_similar_names(normalized_field, list(fields.keys()))
            return {
                "valid": False,
                "field_name": normalized_field,
                "object_name": normalized_obj,
                "suggestions": suggestions,
                "message": f"Field '{normalized_field}' not found on {normalized_obj}"
            }
        
        # Object not in cache
        if normalized_field.endswith("__c"):
            return {
                "valid": False,
                "field_name": normalized_field,
                "object_name": normalized_obj,
                "warning": True,
                "message": f"Cannot validate '{normalized_field}' - object '{normalized_obj}' not in metadata cache"
            }
        
        # Might be standard field on uncached object
        if normalized_field in STANDARD_FIELDS:
            return {
                "valid": True,
                "field_name": normalized_field,
                "object_name": normalized_obj,
                "custom": False,
                "warning": True,
                "message": f"Standard field '{normalized_field}' (object not cached)"
            }
        
        return {
            "valid": False,
            "field_name": normalized_field,
            "object_name": normalized_obj,
            "suggestions": self._find_similar_names(normalized_field, list(STANDARD_FIELDS)),
            "message": f"Invalid field: '{normalized_field}'"
        }
    
    def validate_picklist_value(
        self, 
        object_name: str, 
        field_name: str, 
        value: str
    ) -> Dict[str, Any]:
        """
        Validate a picklist value.
        """
        self._load_cache()
        
        if object_name not in self._picklists_cache:
            return {
                "valid": False,
                "warning": True,
                "message": f"Object '{object_name}' not in cache"
            }
        
        picklists = self._picklists_cache[object_name]
        
        if field_name not in picklists:
            return {
                "valid": False,
                "warning": True,
                "message": f"Field '{field_name}' is not a picklist or not cached"
            }
        
        valid_values = picklists[field_name]
        
        if value in valid_values:
            return {
                "valid": True,
                "value": value,
                "message": f"Valid picklist value"
            }
        
        # Find suggestions
        suggestions = self._find_similar_names(value, valid_values, threshold=0.5)
        
        return {
            "valid": False,
            "value": value,
            "suggestions": suggestions,
            "valid_values": valid_values[:10],  # Return first 10 for reference
            "message": f"Invalid picklist value: '{value}'"
        }
    
    def validate_selector(self, selector: str) -> Dict[str, Any]:
        """
        Validate a Salesforce selector pattern.
        
        Returns validation results and extracted metadata references.
        """
        results = {
            "valid": True,
            "selector": selector,
            "warnings": [],
            "extracted": {
                "fields": [],
                "objects": [],
                "record_ids": [],
                "components": []
            },
            "suggestions": []
        }
        
        # Check for Lightning components
        lightning_matches = re.findall(SF_SELECTOR_PATTERNS['lightning-component'], selector)
        for comp in lightning_matches:
            results["extracted"]["components"].append(comp)
            if comp in LIGHTNING_PATTERNS:
                results["suggestions"].append(f"Valid Lightning component: {comp}")
            else:
                results["warnings"].append(f"Unknown Lightning component: {comp}")
        
        # Check for LWC components
        lwc_matches = re.findall(SF_SELECTOR_PATTERNS['lwc-component'], selector)
        results["extracted"]["components"].extend(lwc_matches)
        
        # Check for field references
        field_matches = re.findall(SF_SELECTOR_PATTERNS['custom-field'], selector)
        for field in field_matches:
            if field not in results["extracted"]["fields"]:
                results["extracted"]["fields"].append(field)
        
        # Check for data-field attributes
        data_field_matches = re.findall(SF_SELECTOR_PATTERNS['data-field'], selector)
        for field in data_field_matches:
            if field not in results["extracted"]["fields"]:
                results["extracted"]["fields"].append(field)
        
        # Check for object references
        obj_matches = re.findall(SF_SELECTOR_PATTERNS['custom-object'], selector)
        for obj in obj_matches:
            if obj not in results["extracted"]["objects"]:
                results["extracted"]["objects"].append(obj)
        
        # Check for record IDs
        record_id_matches = re.findall(SF_SELECTOR_PATTERNS['record-id'], selector)
        results["extracted"]["record_ids"] = record_id_matches
        
        # Check for dynamic/unstable patterns (warnings)
        unstable_patterns = [
            (r'auraId_\d+', "Aura dynamic ID (unstable)"),
            (r'lwc-\d+', "LWC dynamic ID (unstable)"),
            (r'slds-\d+', "SLDS dynamic class (unstable)"),
            (r'ember\d+', "Ember ID (unstable)"),
            (r'id=["\']\d+["\']', "Numeric ID (unstable)"),
        ]
        
        for pattern, warning in unstable_patterns:
            if re.search(pattern, selector):
                results["warnings"].append(warning)
                results["valid"] = False
        
        # Validate extracted fields
        self._load_cache()
        for field in results["extracted"]["fields"]:
            # Try to validate field (without knowing the object)
            found = False
            for obj, fields in self._fields_cache.items():
                if field in fields:
                    found = True
                    results["suggestions"].append(f"Field '{field}' found on {obj}")
                    break
            
            if not found and field.endswith("__c"):
                results["warnings"].append(f"Custom field '{field}' not found in cache")
        
        return results
    
    def validate_workflow_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a single workflow step for Salesforce metadata.
        
        Args:
            step: Workflow step with selector, action, value, etc.
            
        Returns:
            Validation results with field/object/selector validation
        """
        results = {
            "step_valid": True,
            "validations": [],
            "warnings": [],
            "suggestions": []
        }
        
        selector = step.get("selector", "")
        action = step.get("action", step.get("type", ""))
        value = step.get("value", "")
        target = step.get("target", "")
        
        # Validate selector
        selector_validation = self.validate_selector(selector)
        if not selector_validation["valid"]:
            results["step_valid"] = False
        results["validations"].append({
            "type": "selector",
            "result": selector_validation
        })
        results["warnings"].extend(selector_validation.get("warnings", []))
        
        # If we extracted fields, validate them
        for field in selector_validation["extracted"].get("fields", []):
            # Try to find which object this field belongs to
            for obj_name, fields in self._fields_cache.items():
                if field in fields:
                    field_validation = self.validate_field(obj_name, field)
                    results["validations"].append({
                        "type": "field",
                        "object": obj_name,
                        "field": field,
                        "result": field_validation
                    })
                    break
        
        # If input action and value looks like a picklist value
        if action in ["input", "select", "fill", "type"] and value:
            # Check if value matches any known picklist
            for obj_name, picklists in self._picklists_cache.items():
                for field_name, values in picklists.items():
                    if value in values:
                        results["suggestions"].append(
                            f"Value '{value}' matches picklist {obj_name}.{field_name}"
                        )
        
        return results
    
    def validate_workflow(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate an entire workflow for Salesforce metadata.
        
        Args:
            workflow: Workflow with nodes/steps
            
        Returns:
            Full validation report
        """
        results = {
            "workflow_valid": True,
            "total_steps": 0,
            "valid_steps": 0,
            "warnings_count": 0,
            "steps": [],
            "summary": {
                "objects_referenced": set(),
                "fields_referenced": set(),
                "components_used": set(),
                "invalid_selectors": [],
                "unknown_fields": []
            }
        }
        
        steps = workflow.get("nodes", workflow.get("steps", []))
        results["total_steps"] = len(steps)
        
        for i, step in enumerate(steps):
            step_data = step.get("data", step) if isinstance(step, dict) else step
            step_result = self.validate_workflow_step(step_data)
            step_result["step_index"] = i
            step_result["step_name"] = step_data.get("label", step_data.get("name", f"Step {i+1}"))
            
            if step_result["step_valid"]:
                results["valid_steps"] += 1
            else:
                results["workflow_valid"] = False
            
            results["warnings_count"] += len(step_result.get("warnings", []))
            results["steps"].append(step_result)
            
            # Aggregate extracted metadata
            for validation in step_result.get("validations", []):
                if validation["type"] == "selector":
                    extracted = validation["result"].get("extracted", {})
                    results["summary"]["objects_referenced"].update(extracted.get("objects", []))
                    results["summary"]["fields_referenced"].update(extracted.get("fields", []))
                    results["summary"]["components_used"].update(extracted.get("components", []))
        
        # Convert sets to lists for JSON serialization
        results["summary"]["objects_referenced"] = list(results["summary"]["objects_referenced"])
        results["summary"]["fields_referenced"] = list(results["summary"]["fields_referenced"])
        results["summary"]["components_used"] = list(results["summary"]["components_used"])
        
        return results
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _find_similar_names(
        self, 
        name: str, 
        candidates: List[str], 
        threshold: float = 0.6,
        max_results: int = 5
    ) -> List[str]:
        """Find similar names using sequence matching"""
        if not candidates:
            return []
        
        name_lower = name.lower()
        scored = []
        
        for candidate in candidates:
            ratio = SequenceMatcher(None, name_lower, candidate.lower()).ratio()
            if ratio >= threshold:
                scored.append((candidate, ratio))
        
        # Sort by similarity score
        scored.sort(key=lambda x: x[1], reverse=True)
        
        return [s[0] for s in scored[:max_results]]
    
    def get_field_suggestions(
        self, 
        object_name: str, 
        partial: str,
        limit: int = 10
    ) -> List[Dict[str, str]]:
        """
        Get field suggestions for autocomplete.
        """
        self._load_cache()
        
        if object_name not in self._fields_cache:
            # Fall back to standard fields
            fields = {f: {"label": f, "type": "unknown"} for f in STANDARD_FIELDS}
        else:
            fields = self._fields_cache[object_name]
        
        partial_lower = partial.lower()
        matches = []
        
        for field_name, field_data in fields.items():
            if partial_lower in field_name.lower() or partial_lower in field_data.get("label", "").lower():
                matches.append({
                    "name": field_name,
                    "label": field_data.get("label", field_name),
                    "type": field_data.get("type", "unknown")
                })
        
        return matches[:limit]
    
    def get_object_suggestions(self, partial: str, limit: int = 10) -> List[Dict[str, str]]:
        """
        Get object suggestions for autocomplete.
        """
        self._load_cache()
        
        partial_lower = partial.lower()
        matches = []
        
        # Check cached objects
        for obj_name, obj_data in self._objects_cache.items():
            if partial_lower in obj_name.lower() or partial_lower in obj_data.get("label", "").lower():
                matches.append({
                    "name": obj_name,
                    "label": obj_data.get("label", obj_name),
                    "custom": obj_data.get("custom", obj_name.endswith("__c"))
                })
        
        # Add standard objects not in cache
        for obj in STANDARD_OBJECTS:
            if obj not in self._objects_cache and partial_lower in obj.lower():
                matches.append({
                    "name": obj,
                    "label": obj,
                    "custom": False
                })
        
        return matches[:limit]
    
    def get_cache_status(self) -> Dict[str, Any]:
        """Get status of metadata cache"""
        self._load_cache()
        
        return {
            "loaded": self._cache_loaded,
            "objects_count": len(self._objects_cache),
            "fields_count": sum(len(f) for f in self._fields_cache.values()),
            "picklists_count": sum(len(p) for p in self._picklists_cache.values()),
            "last_updated": self._cache_timestamp.isoformat() if self._cache_timestamp else None,
            "connected_to_org": self.is_connected(),
            "instance_url": self.instance_url
        }


# Singleton instance
_metadata_service: Optional[SalesforceMetadataService] = None


def get_metadata_service() -> SalesforceMetadataService:
    """Get or create the metadata service singleton"""
    global _metadata_service
    if _metadata_service is None:
        _metadata_service = SalesforceMetadataService()
    return _metadata_service












