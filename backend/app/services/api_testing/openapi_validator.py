"""
OpenAPI Specification Validator and Auto-Complete Engine

Handles incomplete/problematic OpenAPI specs gracefully:
- Validates specs and reports issues with severity levels
- Auto-generates missing schemas from real responses
- Suggests improvements and best practices
- Handles partial specs without failing

Common problems handled:
- Missing request body schemas
- Missing response schemas  
- Missing example values
- Undocumented authentication
- Inconsistent parameter descriptions
- Missing error responses (4xx, 5xx)
"""

import json
import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from uuid import uuid4
from enum import Enum

logger = logging.getLogger(__name__)


class IssueSeverity(Enum):
    """Severity levels for spec issues"""
    ERROR = "error"           # Breaks functionality
    WARNING = "warning"       # May cause problems
    INFO = "info"             # Suggestions for improvement
    HINT = "hint"             # Best practice recommendations


class SpecIssue:
    """Represents an issue found in the spec"""
    
    def __init__(
        self,
        severity: IssueSeverity,
        message: str,
        path: str,
        suggestion: Optional[str] = None,
        auto_fix: Optional[Dict[str, Any]] = None
    ):
        self.id = str(uuid4())[:8]
        self.severity = severity
        self.message = message
        self.path = path  # JSONPath to the issue location
        self.suggestion = suggestion
        self.auto_fix = auto_fix  # Auto-fix data if available
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "severity": self.severity.value,
            "message": self.message,
            "path": self.path,
            "suggestion": self.suggestion,
            "has_auto_fix": self.auto_fix is not None
        }


class OpenAPIValidator:
    """
    Validates OpenAPI specifications and suggests improvements
    """
    
    # Common HTTP status codes that should have responses defined
    EXPECTED_ERROR_CODES = ["400", "401", "403", "404", "500"]
    
    # Common authentication schemes
    AUTH_SCHEMES = ["bearer", "basic", "apikey", "oauth2", "openIdConnect"]
    
    def __init__(self):
        self.issues: List[SpecIssue] = []
        self.spec: Dict[str, Any] = {}
        self.auto_fixes: Dict[str, Any] = {}
        
    def validate(self, spec: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate an OpenAPI specification
        
        Args:
            spec: Parsed OpenAPI specification
            
        Returns:
            Validation result with issues and suggestions
        """
        self.issues = []
        self.spec = spec
        self.auto_fixes = {}
        
        # Run all validation checks
        self._check_basic_structure()
        self._check_info_section()
        self._check_servers()
        self._check_paths()
        self._check_components()
        self._check_security()
        self._check_best_practices()
        
        # Categorize issues by severity
        errors = [i for i in self.issues if i.severity == IssueSeverity.ERROR]
        warnings = [i for i in self.issues if i.severity == IssueSeverity.WARNING]
        infos = [i for i in self.issues if i.severity == IssueSeverity.INFO]
        hints = [i for i in self.issues if i.severity == IssueSeverity.HINT]
        
        return {
            "valid": len(errors) == 0,
            "usable": len(errors) == 0,  # Can still use spec even with warnings
            "summary": {
                "errors": len(errors),
                "warnings": len(warnings),
                "info": len(infos),
                "hints": len(hints),
                "total_issues": len(self.issues)
            },
            "issues": [i.to_dict() for i in self.issues],
            "auto_fixes_available": len([i for i in self.issues if i.auto_fix]),
            "spec_version": spec.get("openapi") or spec.get("swagger", "unknown"),
            "validated_at": datetime.utcnow().isoformat()
        }
        
    def _check_basic_structure(self):
        """Check basic OpenAPI structure"""
        # Check version
        if not self.spec.get("openapi") and not self.spec.get("swagger"):
            self.issues.append(SpecIssue(
                IssueSeverity.ERROR,
                "Missing OpenAPI/Swagger version",
                "$",
                "Add 'openapi: 3.0.0' or 'swagger: 2.0' to the root"
            ))
            
        # Check for paths
        if not self.spec.get("paths"):
            self.issues.append(SpecIssue(
                IssueSeverity.ERROR,
                "No paths defined",
                "$.paths",
                "Add at least one API endpoint path"
            ))
            
    def _check_info_section(self):
        """Check info section"""
        info = self.spec.get("info", {})
        
        if not info:
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                "Missing info section",
                "$.info",
                "Add info section with title and version"
            ))
            return
            
        if not info.get("title"):
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                "Missing API title",
                "$.info.title",
                "Add a descriptive title for your API"
            ))
            
        if not info.get("version"):
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                "Missing API version",
                "$.info.version",
                "Add version string (e.g., '1.0.0')"
            ))
            
        if not info.get("description"):
            self.issues.append(SpecIssue(
                IssueSeverity.INFO,
                "Missing API description",
                "$.info.description",
                "Add a description to help API consumers understand your API"
            ))
            
    def _check_servers(self):
        """Check servers section"""
        servers = self.spec.get("servers", [])
        
        if not servers:
            self.issues.append(SpecIssue(
                IssueSeverity.INFO,
                "No servers defined",
                "$.servers",
                "Add server URLs for different environments (dev, staging, prod)"
            ))
            
    def _check_paths(self):
        """Check all paths and operations"""
        paths = self.spec.get("paths", {})
        
        for path, methods in paths.items():
            if not isinstance(methods, dict):
                continue
                
            for method, operation in methods.items():
                if method.lower() not in ["get", "post", "put", "patch", "delete", "head", "options"]:
                    continue
                    
                if not isinstance(operation, dict):
                    continue
                    
                self._check_operation(path, method, operation)
                
    def _check_operation(self, path: str, method: str, operation: Dict[str, Any]):
        """Check a single operation"""
        op_path = f"$.paths.{path}.{method}"
        
        # Check operation ID
        if not operation.get("operationId"):
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                f"Missing operationId for {method.upper()} {path}",
                op_path,
                "Add unique operationId for code generation and documentation",
                auto_fix={"operationId": self._generate_operation_id(path, method)}
            ))
            
        # Check summary/description
        if not operation.get("summary") and not operation.get("description"):
            self.issues.append(SpecIssue(
                IssueSeverity.INFO,
                f"Missing summary/description for {method.upper()} {path}",
                op_path,
                "Add summary to describe what this endpoint does"
            ))
            
        # Check request body for POST/PUT/PATCH
        if method.lower() in ["post", "put", "patch"]:
            self._check_request_body(path, method, operation, op_path)
            
        # Check responses
        self._check_responses(path, method, operation, op_path)
        
        # Check parameters
        self._check_parameters(path, method, operation, op_path)
        
    def _check_request_body(self, path: str, method: str, operation: Dict[str, Any], op_path: str):
        """Check request body definition"""
        request_body = operation.get("requestBody")
        
        if not request_body:
            # POST/PUT/PATCH usually need request body
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                f"Missing request body for {method.upper()} {path}",
                f"{op_path}.requestBody",
                "Add requestBody with schema definition",
                auto_fix=self._generate_empty_request_body()
            ))
            return
            
        # Check content
        content = request_body.get("content", {})
        if not content:
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                f"Request body has no content type defined for {method.upper()} {path}",
                f"{op_path}.requestBody.content",
                "Add content type (e.g., application/json)"
            ))
            return
            
        # Check schema in content
        for content_type, media_type in content.items():
            schema = media_type.get("schema", {})
            if not schema:
                self.issues.append(SpecIssue(
                    IssueSeverity.WARNING,
                    f"Missing schema for {content_type} in {method.upper()} {path}",
                    f"{op_path}.requestBody.content.{content_type}.schema",
                    "Add schema definition for request body"
                ))
            elif schema.get("type") == "object" and not schema.get("properties"):
                self.issues.append(SpecIssue(
                    IssueSeverity.WARNING,
                    f"Object schema has no properties for {method.upper()} {path}",
                    f"{op_path}.requestBody.content.{content_type}.schema.properties",
                    "Define properties for the request object"
                ))
                
            # Check for examples
            if not media_type.get("example") and not media_type.get("examples"):
                self.issues.append(SpecIssue(
                    IssueSeverity.HINT,
                    f"No example provided for request body in {method.upper()} {path}",
                    f"{op_path}.requestBody.content.{content_type}",
                    "Add example to help API consumers understand expected format"
                ))
                
    def _check_responses(self, path: str, method: str, operation: Dict[str, Any], op_path: str):
        """Check responses definition"""
        responses = operation.get("responses", {})
        
        if not responses:
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                f"No responses defined for {method.upper()} {path}",
                f"{op_path}.responses",
                "Add at least one response (e.g., 200)",
                auto_fix={"200": {"description": "Successful response"}}
            ))
            return
            
        # Check for success response
        has_success = any(str(code).startswith("2") for code in responses.keys())
        if not has_success:
            self.issues.append(SpecIssue(
                IssueSeverity.WARNING,
                f"No success response (2xx) defined for {method.upper()} {path}",
                f"{op_path}.responses",
                "Add a 200 or 201 response for successful operations"
            ))
            
        # Check for common error responses
        defined_codes = set(str(code) for code in responses.keys())
        missing_error_codes = []
        
        for code in self.EXPECTED_ERROR_CODES:
            if code not in defined_codes:
                missing_error_codes.append(code)
                
        if missing_error_codes:
            self.issues.append(SpecIssue(
                IssueSeverity.INFO,
                f"Missing common error responses ({', '.join(missing_error_codes)}) for {method.upper()} {path}",
                f"{op_path}.responses",
                "Consider adding error responses for better API documentation"
            ))
            
        # Check response schemas
        for code, response in responses.items():
            if not isinstance(response, dict):
                continue
                
            if not response.get("description"):
                self.issues.append(SpecIssue(
                    IssueSeverity.INFO,
                    f"Missing description for response {code} in {method.upper()} {path}",
                    f"{op_path}.responses.{code}.description",
                    "Add description for this response"
                ))
                
            # Check for schema in non-204 responses
            if str(code) != "204":
                content = response.get("content", {})
                if content:
                    for content_type, media_type in content.items():
                        if not media_type.get("schema"):
                            self.issues.append(SpecIssue(
                                IssueSeverity.WARNING,
                                f"Missing schema for response {code} ({content_type}) in {method.upper()} {path}",
                                f"{op_path}.responses.{code}.content.{content_type}.schema",
                                "Add schema definition for response"
                            ))
                            
    def _check_parameters(self, path: str, method: str, operation: Dict[str, Any], op_path: str):
        """Check parameters definition"""
        parameters = operation.get("parameters", [])
        
        # Check path parameters are defined
        path_params = re.findall(r'\{(\w+)\}', path)
        defined_params = {p.get("name") for p in parameters if p.get("in") == "path"}
        
        for param in path_params:
            if param not in defined_params:
                self.issues.append(SpecIssue(
                    IssueSeverity.ERROR,
                    f"Path parameter '{param}' not defined for {method.upper()} {path}",
                    f"{op_path}.parameters",
                    f"Add parameter definition for '{param}'",
                    auto_fix={
                        "name": param,
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"}
                    }
                ))
                
        # Check parameter details
        for i, param in enumerate(parameters):
            if not param.get("description"):
                self.issues.append(SpecIssue(
                    IssueSeverity.HINT,
                    f"Missing description for parameter '{param.get('name')}' in {method.upper()} {path}",
                    f"{op_path}.parameters[{i}].description",
                    "Add description to help API consumers"
                ))
                
            if not param.get("schema"):
                self.issues.append(SpecIssue(
                    IssueSeverity.WARNING,
                    f"Missing schema for parameter '{param.get('name')}' in {method.upper()} {path}",
                    f"{op_path}.parameters[{i}].schema",
                    "Add schema with type definition"
                ))
                
    def _check_components(self):
        """Check components/definitions section"""
        components = self.spec.get("components", {})
        schemas = components.get("schemas", {})
        
        if not schemas:
            self.issues.append(SpecIssue(
                IssueSeverity.INFO,
                "No reusable schemas defined in components",
                "$.components.schemas",
                "Consider defining reusable schemas for common objects"
            ))
            
    def _check_security(self):
        """Check security definitions"""
        # Check for security schemes
        components = self.spec.get("components", {})
        security_schemes = components.get("securitySchemes", {})
        
        # Check global security
        global_security = self.spec.get("security", [])
        
        if not security_schemes and not global_security:
            self.issues.append(SpecIssue(
                IssueSeverity.INFO,
                "No security schemes defined",
                "$.components.securitySchemes",
                "Consider adding authentication requirements if your API requires auth"
            ))
            
    def _check_best_practices(self):
        """Check best practices"""
        # Check for tags
        if not self.spec.get("tags"):
            paths = self.spec.get("paths", {})
            if len(paths) > 5:
                self.issues.append(SpecIssue(
                    IssueSeverity.HINT,
                    "Consider using tags to organize endpoints",
                    "$.tags",
                    "Add tags array and tag operations for better organization"
                ))
                
        # Check for deprecated endpoints
        for path, methods in self.spec.get("paths", {}).items():
            for method, operation in methods.items():
                if isinstance(operation, dict) and operation.get("deprecated"):
                    if not operation.get("description") or "deprecated" not in operation.get("description", "").lower():
                        self.issues.append(SpecIssue(
                            IssueSeverity.INFO,
                            f"Deprecated endpoint {method.upper()} {path} should explain deprecation",
                            f"$.paths.{path}.{method}.description",
                            "Add deprecation notice and migration path to description"
                        ))
                        
    def _generate_operation_id(self, path: str, method: str) -> str:
        """Generate operationId from path and method"""
        # Remove path parameters and clean up
        clean_path = re.sub(r'\{[^}]+\}', '', path)
        parts = [p for p in clean_path.split('/') if p]
        
        if parts:
            resource = parts[-1] if parts else "resource"
            if method.lower() == "get":
                if "{" in path:
                    return f"get{resource.title()}"
                return f"list{resource.title()}"
            elif method.lower() == "post":
                return f"create{resource.title()}"
            elif method.lower() == "put":
                return f"update{resource.title()}"
            elif method.lower() == "patch":
                return f"patch{resource.title()}"
            elif method.lower() == "delete":
                return f"delete{resource.title()}"
                
        return f"{method}_{path.replace('/', '_').strip('_')}"
        
    def _generate_empty_request_body(self) -> Dict[str, Any]:
        """Generate empty request body template"""
        return {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {}
                    }
                }
            }
        }
        
    def apply_auto_fixes(self, spec: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
        """
        Apply all available auto-fixes to the spec
        
        Args:
            spec: Original spec
            
        Returns:
            Tuple of (fixed_spec, list of applied fixes)
        """
        fixed_spec = json.loads(json.dumps(spec))  # Deep copy
        applied_fixes = []
        
        for issue in self.issues:
            if issue.auto_fix:
                try:
                    self._apply_fix(fixed_spec, issue.path, issue.auto_fix)
                    applied_fixes.append(f"{issue.path}: {issue.message}")
                except Exception as e:
                    logger.warning(f"Failed to apply auto-fix for {issue.path}: {e}")
                    
        return fixed_spec, applied_fixes
        
    def _apply_fix(self, spec: Dict[str, Any], path: str, fix: Any):
        """Apply a single fix to the spec at the given path"""
        # Parse JSONPath-like path
        parts = path.replace("$.", "").replace("$", "").split(".")
        parts = [p for p in parts if p]
        
        if not parts:
            return
            
        # Navigate to parent
        current = spec
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
            
        # Apply fix
        last_part = parts[-1]
        if isinstance(fix, dict):
            if last_part not in current:
                current[last_part] = {}
            current[last_part].update(fix)
        else:
            current[last_part] = fix


class SchemaInferenceEngine:
    """
    Infers schemas from actual API responses
    Useful when OpenAPI spec is incomplete
    """
    
    def infer_schema(self, data: Any, max_depth: int = 10) -> Dict[str, Any]:
        """
        Infer JSON schema from actual data
        
        Args:
            data: JSON data to infer schema from
            max_depth: Maximum nesting depth
            
        Returns:
            JSON Schema
        """
        if max_depth <= 0:
            return {}
            
        if data is None:
            return {"type": "null"}
            
        if isinstance(data, bool):
            return {"type": "boolean"}
            
        if isinstance(data, int):
            return {"type": "integer"}
            
        if isinstance(data, float):
            return {"type": "number"}
            
        if isinstance(data, str):
            schema = {"type": "string"}
            # Detect common formats
            if self._is_date(data):
                schema["format"] = "date"
            elif self._is_datetime(data):
                schema["format"] = "date-time"
            elif self._is_email(data):
                schema["format"] = "email"
            elif self._is_uuid(data):
                schema["format"] = "uuid"
            elif self._is_uri(data):
                schema["format"] = "uri"
            return schema
            
        if isinstance(data, list):
            if not data:
                return {"type": "array", "items": {}}
            # Infer from first item (could merge multiple)
            return {
                "type": "array",
                "items": self.infer_schema(data[0], max_depth - 1)
            }
            
        if isinstance(data, dict):
            properties = {}
            required = []
            
            for key, value in data.items():
                properties[key] = self.infer_schema(value, max_depth - 1)
                if value is not None:
                    required.append(key)
                    
            schema = {
                "type": "object",
                "properties": properties
            }
            if required:
                schema["required"] = required
                
            return schema
            
        return {}
        
    def _is_date(self, s: str) -> bool:
        return bool(re.match(r'^\d{4}-\d{2}-\d{2}$', s))
        
    def _is_datetime(self, s: str) -> bool:
        return bool(re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', s))
        
    def _is_email(self, s: str) -> bool:
        return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', s))
        
    def _is_uuid(self, s: str) -> bool:
        return bool(re.match(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', s, re.I))
        
    def _is_uri(self, s: str) -> bool:
        return bool(re.match(r'^https?://', s))
        
    def merge_schemas(self, schemas: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Merge multiple inferred schemas into one
        Useful when you have multiple response samples
        """
        if not schemas:
            return {}
            
        if len(schemas) == 1:
            return schemas[0]
            
        # Start with first schema
        merged = json.loads(json.dumps(schemas[0]))
        
        for schema in schemas[1:]:
            merged = self._merge_two_schemas(merged, schema)
            
        return merged
        
    def _merge_two_schemas(self, s1: Dict, s2: Dict) -> Dict:
        """Merge two schemas"""
        if s1.get("type") != s2.get("type"):
            # Types differ - use oneOf
            return {"oneOf": [s1, s2]}
            
        if s1.get("type") == "object":
            # Merge properties
            props1 = s1.get("properties", {})
            props2 = s2.get("properties", {})
            
            all_props = set(props1.keys()) | set(props2.keys())
            merged_props = {}
            
            for prop in all_props:
                if prop in props1 and prop in props2:
                    merged_props[prop] = self._merge_two_schemas(props1[prop], props2[prop])
                elif prop in props1:
                    merged_props[prop] = props1[prop]
                else:
                    merged_props[prop] = props2[prop]
                    
            # Required is intersection (present in both)
            req1 = set(s1.get("required", []))
            req2 = set(s2.get("required", []))
            required = list(req1 & req2)
            
            result = {"type": "object", "properties": merged_props}
            if required:
                result["required"] = required
            return result
            
        if s1.get("type") == "array":
            # Merge items
            items1 = s1.get("items", {})
            items2 = s2.get("items", {})
            return {
                "type": "array",
                "items": self._merge_two_schemas(items1, items2)
            }
            
        # Same type, return first (could add more logic)
        return s1


# Singleton instances
_validator = None
_schema_inference = None

def get_openapi_validator() -> OpenAPIValidator:
    global _validator
    if _validator is None:
        _validator = OpenAPIValidator()
    return _validator
    
def get_schema_inference_engine() -> SchemaInferenceEngine:
    global _schema_inference
    if _schema_inference is None:
        _schema_inference = SchemaInferenceEngine()
    return _schema_inference
