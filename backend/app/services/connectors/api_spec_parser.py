"""
API Specification Parser
Enhanced parsers for WSDL, OpenAPI/Swagger, GraphQL, Postman collections
"""

import logging
import json
import xml.etree.ElementTree as ET
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse
import re

logger = logging.getLogger(__name__)


class APISpecParser:
    """Enhanced parser for various API specification formats"""
    
    def __init__(self):
        self.supported_formats = ["openapi", "swagger", "wsdl", "postman", "graphql", "rest"]
    
    def parse(self, spec_content: str, spec_format: str, content_type: str = "json") -> Dict[str, Any]:
        """
        Parse API specification from various formats
        
        Args:
            spec_content: Raw specification content (JSON, XML, YAML string)
            spec_format: Format type (openapi, swagger, wsdl, postman, graphql)
            content_type: Content type (json, xml, yaml)
            
        Returns:
            Normalized API specification dictionary
        """
        try:
            if spec_format.lower() in ["openapi", "swagger", "rest"]:
                return self._parse_openapi(spec_content, content_type)
            elif spec_format.lower() == "postman":
                return self._parse_postman(spec_content, content_type)
            elif spec_format.lower() == "graphql":
                return self._parse_graphql(spec_content, content_type)
            elif spec_format.lower() == "wsdl":
                return self._parse_wsdl(spec_content, content_type)
            else:
                raise ValueError(f"Unsupported format: {spec_format}")
        except Exception as e:
            logger.error(f"Error parsing {spec_format} spec: {e}", exc_info=True)
            raise
    
    def _parse_openapi(self, content: str, content_type: str) -> Dict[str, Any]:
        """Parse OpenAPI/Swagger specification"""
        # Clean up content - remove any leading/trailing whitespace
        content = content.strip()
        
        # Try to detect if content is already a JSON string (double-encoded)
        if content.startswith('"') and content.endswith('"'):
            try:
                # It might be a JSON-encoded string, try to decode it
                content = json.loads(content)
                if isinstance(content, str):
                    content = content.strip()
            except:
                pass
        
        if content_type == "json":
            try:
                spec = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}, content preview: {content[:200]}")
                raise ValueError(f"Invalid JSON format: {str(e)}. Please ensure your OpenAPI spec is valid JSON.")
        elif content_type == "yaml":
            try:
                import yaml
                spec = yaml.safe_load(content)
            except ImportError:
                logger.warning("PyYAML not installed, trying JSON parsing")
                try:
                    spec = json.loads(content)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON format: {str(e)}. Please install PyYAML for YAML support or provide valid JSON.")
        else:
            try:
                spec = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}, content preview: {content[:200]}")
                raise ValueError(f"Invalid JSON format: {str(e)}")
        
        normalized = {
            "format": "openapi",
            "version": spec.get("openapi") or spec.get("swagger", "unknown"),
            "info": spec.get("info", {}),
            "base_url": self._extract_base_url(spec),
            "servers": spec.get("servers", []),
            "paths": {},
            "components": spec.get("components", {}),
            "security": spec.get("security", []),
            "tags": spec.get("tags", [])
        }
        
        # Normalize paths
        paths = spec.get("paths", {})
        for path, methods in paths.items():
            normalized["paths"][path] = {}
            for method, operation in methods.items():
                if method.upper() in ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]:
                    normalized["paths"][path][method.upper()] = {
                        "operation_id": operation.get("operationId", f"{method}_{path.replace('/', '_').strip('_')}"),
                        "summary": operation.get("summary", ""),
                        "description": operation.get("description", ""),
                        "parameters": self._normalize_parameters(operation.get("parameters", [])),
                        "request_body": self._normalize_request_body(operation.get("requestBody", {})),
                        "responses": self._normalize_responses(operation.get("responses", {})),
                        "tags": operation.get("tags", []),
                        "security": operation.get("security", []),
                        "deprecated": operation.get("deprecated", False)
                    }
        
        return normalized
    
    def _parse_postman(self, content: str, content_type: str) -> Dict[str, Any]:
        """Parse Postman collection"""
        if content_type == "json":
            collection = json.loads(content)
        else:
            collection = json.loads(content)
        
        normalized = {
            "format": "postman",
            "version": collection.get("info", {}).get("schema", "unknown"),
            "info": collection.get("info", {}),
            "base_url": self._extract_postman_base_url(collection),
            "variables": collection.get("variable", []),
            "paths": {},
            "auth": collection.get("auth", {})
        }
        
        # Process items recursively
        items = collection.get("item", [])
        self._process_postman_items(items, normalized["paths"], "")
        
        return normalized
    
    def _process_postman_items(self, items: List[Dict], paths: Dict, parent_path: str):
        """Recursively process Postman collection items"""
        for item in items:
            if "request" in item:
                request = item["request"]
                method = request.get("method", "GET").upper()
                url_obj = request.get("url", {})
                
                # Extract path
                if isinstance(url_obj, str):
                    path = urlparse(url_obj).path
                elif isinstance(url_obj, dict):
                    path = "/".join(url_obj.get("path", []))
                    if not path.startswith("/"):
                        path = "/" + path
                else:
                    path = item.get("name", "").lower().replace(" ", "-")
                
                full_path = parent_path + path
                if full_path not in paths:
                    paths[full_path] = {}
                
                # Extract query params
                query_params = []
                if isinstance(url_obj, dict):
                    query = url_obj.get("query", [])
                    for q in query:
                        if isinstance(q, dict):
                            query_params.append({
                                "name": q.get("key", ""),
                                "in": "query",
                                "description": q.get("description", ""),
                                "required": q.get("disabled", False) == False,
                                "schema": {"type": "string", "example": q.get("value", "")}
                            })
                
                # Extract headers
                headers = request.get("header", [])
                header_params = []
                for h in headers:
                    if isinstance(h, dict):
                        header_params.append({
                            "name": h.get("key", ""),
                            "in": "header",
                            "description": h.get("description", ""),
                            "required": h.get("disabled", False) == False,
                            "schema": {"type": "string", "example": h.get("value", "")}
                        })
                
                # Extract body
                request_body = {}
                body = request.get("body", {})
                if body:
                    mode = body.get("mode", "")
                    if mode == "raw":
                        try:
                            body_content = body.get("raw", "")
                            if body_content:
                                body_json = json.loads(body_content)
                                request_body = {
                                    "content": {
                                        "application/json": {
                                            "schema": self._infer_schema_from_json(body_json)
                                        }
                                    }
                                }
                        except:
                            request_body = {"content": {"text/plain": {"schema": {"type": "string"}}}}
                    elif mode == "formdata":
                        formdata = body.get("formdata", [])
                        properties = {}
                        for f in formdata:
                            if isinstance(f, dict):
                                properties[f.get("key", "")] = {
                                    "type": f.get("type", "string"),
                                    "description": f.get("description", "")
                                }
                        request_body = {
                            "content": {
                                "multipart/form-data": {
                                    "schema": {
                                        "type": "object",
                                        "properties": properties
                                    }
                                }
                            }
                        }
                
                paths[full_path][method] = {
                    "operation_id": item.get("name", "").lower().replace(" ", "_"),
                    "summary": item.get("name", ""),
                    "description": item.get("description", ""),
                    "parameters": query_params + header_params,
                    "request_body": request_body,
                    "responses": self._extract_postman_responses(item),
                    "tags": [item.get("name", "")],
                    "postman_id": item.get("id", "")
                }
            
            # Process nested folders
            if "item" in item:
                folder_name = item.get("name", "").lower().replace(" ", "-")
                self._process_postman_items(item["item"], paths, parent_path + "/" + folder_name)
    
    def _parse_graphql(self, content: str, content_type: str) -> Dict[str, Any]:
        """Parse GraphQL schema"""
        if content_type == "json":
            schema_data = json.loads(content)
        else:
            # Try to parse as GraphQL SDL
            schema_data = self._parse_graphql_sdl(content)
        
        normalized = {
            "format": "graphql",
            "version": "graphql",
            "base_url": "",
            "paths": {
                "/graphql": {}
            },
            "schema": schema_data
        }
        
        # Extract queries and mutations
        query_type = schema_data.get("data", {}).get("__schema", {}).get("queryType", {})
        mutation_type = schema_data.get("data", {}).get("__schema", {}).get("mutationType", {})
        
        queries = []
        mutations = []
        
        if query_type:
            query_fields = query_type.get("fields", [])
            queries = query_fields
        
        if mutation_type:
            mutation_fields = mutation_type.get("fields", [])
            mutations = mutation_fields
        
        # Add POST endpoint for GraphQL
        normalized["paths"]["/graphql"]["POST"] = {
            "operation_id": "graphql_query",
            "summary": "GraphQL Query/Mutation Endpoint",
            "description": "GraphQL endpoint supporting queries and mutations",
            "parameters": [],
            "request_body": {
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "query": {"type": "string"},
                                "variables": {"type": "object"},
                                "operationName": {"type": "string"}
                            }
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "GraphQL response",
                    "content": {
                        "application/json": {
                            "schema": {"type": "object"}
                        }
                    }
                }
            },
            "queries": queries,
            "mutations": mutations
        }
        
        return normalized
    
    def _parse_wsdl(self, content: str, content_type: str) -> Dict[str, Any]:
        """Parse WSDL (SOAP) specification"""
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            # Try with namespace handling
            content_clean = re.sub(r'xmlns[^=]*="[^"]*"', '', content)
            root = ET.fromstring(content_clean)
        
        # Register namespaces
        namespaces = {
            'wsdl': 'http://schemas.xmlsoap.org/wsdl/',
            'soap': 'http://schemas.xmlsoap.org/wsdl/soap/',
            'xsd': 'http://www.w3.org/2001/XMLSchema'
        }
        
        normalized = {
            "format": "wsdl",
            "version": "1.1",
            "base_url": "",
            "paths": {},
            "services": [],
            "port_types": [],
            "bindings": [],
            "messages": []
        }
        
        # Extract services
        services = root.findall('.//wsdl:service', namespaces)
        for service in services:
            service_name = service.get("name", "")
            ports = service.findall('.//wsdl:port', namespaces)
            
            for port in ports:
                port_name = port.get("name", "")
                soap_address = port.find('.//soap:address', namespaces)
                location = soap_address.get("location", "") if soap_address is not None else ""
                
                binding_name = port.get("binding", "").split(":")[-1]
                binding = root.find(f'.//wsdl:binding[@name="{binding_name}"]', namespaces)
                
                if binding:
                    operations = binding.findall('.//wsdl:operation', namespaces)
                    for operation in operations:
                        op_name = operation.get("name", "")
                        soap_operation = operation.find('.//soap:operation', namespaces)
                        soap_action = soap_operation.get("soapAction", "") if soap_operation is not None else ""
                        
                        # Extract input/output messages
                        input_msg = operation.find('.//wsdl:input', namespaces)
                        output_msg = operation.find('.//wsdl:output', namespaces)
                        
                        path = f"/{service_name}/{op_name}"
                        normalized["paths"][path] = {
                            "POST": {
                                "operation_id": op_name,
                                "summary": f"SOAP operation: {op_name}",
                                "description": f"SOAP service {service_name} operation {op_name}",
                                "parameters": [],
                                "request_body": {
                                    "content": {
                                        "text/xml": {
                                            "schema": {
                                                "type": "string",
                                                "description": "SOAP envelope"
                                            }
                                        }
                                    }
                                },
                                "responses": {
                                    "200": {
                                        "description": "SOAP response",
                                        "content": {
                                            "text/xml": {
                                                "schema": {"type": "string"}
                                            }
                                        }
                                    }
                                },
                                "soap_action": soap_action,
                                "soap_service": service_name,
                                "soap_port": port_name,
                                "input_message": input_msg.get("message", "").split(":")[-1] if input_msg is not None else "",
                                "output_message": output_msg.get("message", "").split(":")[-1] if output_msg is not None else ""
                            }
                        }
                
                normalized["services"].append({
                    "name": service_name,
                    "port": port_name,
                    "location": location
                })
        
        # Set base URL from first service
        if normalized["services"]:
            normalized["base_url"] = normalized["services"][0].get("location", "")
        
        return normalized
    
    def _parse_graphql_sdl(self, sdl_content: str) -> Dict[str, Any]:
        """Parse GraphQL Schema Definition Language"""
        # This is a simplified parser - for full parsing, use graphql-core library
        queries = []
        mutations = []
        
        # Extract type definitions
        query_match = re.search(r'type\s+Query\s*\{([^}]+)\}', sdl_content, re.DOTALL)
        if query_match:
            query_fields = query_match.group(1)
            for line in query_fields.split('\n'):
                field_match = re.search(r'(\w+)(\([^)]*\))?:\s*([!\w\[\]]+)', line)
                if field_match:
                    queries.append({
                        "name": field_match.group(1),
                        "type": field_match.group(3)
                    })
        
        mutation_match = re.search(r'type\s+Mutation\s*\{([^}]+)\}', sdl_content, re.DOTALL)
        if mutation_match:
            mutation_fields = mutation_match.group(1)
            for line in mutation_fields.split('\n'):
                field_match = re.search(r'(\w+)(\([^)]*\))?:\s*([!\w\[\]]+)', line)
                if field_match:
                    mutations.append({
                        "name": field_match.group(1),
                        "type": field_match.group(3)
                    })
        
        return {
            "data": {
                "__schema": {
                    "queryType": {"fields": queries} if queries else None,
                    "mutationType": {"fields": mutations} if mutations else None
                }
            }
        }
    
    def _extract_base_url(self, spec: Dict[str, Any]) -> str:
        """Extract base URL from OpenAPI spec"""
        servers = spec.get("servers", [])
        if servers:
            return servers[0].get("url", "")
        return ""
    
    def _extract_postman_base_url(self, collection: Dict[str, Any]) -> str:
        """Extract base URL from Postman collection"""
        variables = collection.get("variable", [])
        for var in variables:
            if var.get("key", "").lower() in ["base_url", "baseUrl", "url"]:
                return var.get("value", "")
        return ""
    
    def _normalize_parameters(self, parameters: List[Dict]) -> List[Dict]:
        """Normalize OpenAPI parameters"""
        normalized = []
        for param in parameters:
            normalized.append({
                "name": param.get("name", ""),
                "in": param.get("in", "query"),
                "description": param.get("description", ""),
                "required": param.get("required", False),
                "schema": param.get("schema", {"type": "string"}),
                "example": param.get("example")
            })
        return normalized
    
    def _normalize_request_body(self, request_body: Dict) -> Dict:
        """Normalize OpenAPI request body"""
        if not request_body:
            return {}
        return {
            "description": request_body.get("description", ""),
            "required": request_body.get("required", False),
            "content": request_body.get("content", {})
        }
    
    def _normalize_responses(self, responses: Dict) -> Dict:
        """Normalize OpenAPI responses"""
        normalized = {}
        for status_code, response in responses.items():
            normalized[status_code] = {
                "description": response.get("description", ""),
                "content": response.get("content", {}),
                "headers": response.get("headers", {})
            }
        return normalized
    
    def _extract_postman_responses(self, item: Dict) -> Dict:
        """Extract responses from Postman item"""
        responses = {}
        # Postman doesn't always have responses in collection
        # Try to extract from examples
        examples = item.get("response", [])
        for example in examples:
            status = example.get("code", 200)
            responses[str(status)] = {
                "description": example.get("name", ""),
                "content": {
                    "application/json": {
                        "schema": {"type": "object"}
                    }
                }
            }
        
        if not responses:
            # Default response
            responses["200"] = {
                "description": "Success",
                "content": {
                    "application/json": {
                        "schema": {"type": "object"}
                    }
                }
            }
        
        return responses
    
    def _infer_schema_from_json(self, json_obj: Any) -> Dict[str, Any]:
        """Infer JSON schema from JSON object"""
        if isinstance(json_obj, dict):
            properties = {}
            for key, value in json_obj.items():
                properties[key] = self._infer_schema_from_json(value)
            return {
                "type": "object",
                "properties": properties
            }
        elif isinstance(json_obj, list):
            if json_obj:
                return {
                    "type": "array",
                    "items": self._infer_schema_from_json(json_obj[0])
                }
            return {"type": "array"}
        elif isinstance(json_obj, bool):
            return {"type": "boolean"}
        elif isinstance(json_obj, int):
            return {"type": "integer"}
        elif isinstance(json_obj, float):
            return {"type": "number"}
        else:
            return {"type": "string"}

