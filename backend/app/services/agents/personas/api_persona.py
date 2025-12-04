"""
Rift - API Testing Persona
Ex-Stripe Principal API Test Engineer, 17 years, zero API outages in production for 5 years.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, ValidationError

from app.services.agents.persona_base import AgentPersona

logger = logging.getLogger(__name__)


class APITestCase(BaseModel):
    """Individual API test case."""
    name: str
    endpoint: str
    method: str
    test_type: str  # "positive", "negative", "security", "performance"
    request_payload: Optional[Dict[str, Any]] = None
    expected_status: int
    expected_response_schema: Optional[Dict[str, Any]] = None
    assertions: List[str] = Field(default_factory=list)
    owasp_mapping: Optional[str] = None  # OWASP API Top 10 mapping


class SecurityTest(BaseModel):
    """Security-specific test."""
    name: str
    attack_type: str  # e.g., "SQLi", "XSS", "XXE", "oversized_payload"
    payload: str
    expected_behavior: str
    owasp_category: str


class AuthenticationMatrix(BaseModel):
    """Authentication test matrix."""
    valid_token: APITestCase
    expired_token: APITestCase
    revoked_token: APITestCase
    missing_token: APITestCase
    malformed_token: APITestCase


class APITestSuite(BaseModel):
    """Complete API test suite."""
    test_cases: List[APITestCase]
    security_tests: List[SecurityTest] = Field(default_factory=list)
    authentication_matrix: Optional[AuthenticationMatrix] = None
    postman_collection: str
    newman_command: str
    environment_files: Dict[str, str] = Field(default_factory=dict)
    contract_tests: List[Dict[str, Any]] = Field(default_factory=list)
    owasp_coverage: Dict[str, List[str]] = Field(default_factory=dict)  # category -> test_names


class APIPersona(AgentPersona[APITestSuite]):
    """
    Rift - API Testing Persona
    
    Ex-Stripe Principal API Test Engineer, 17 years, zero API outages in production for 5 years.
    """
    
    def _get_system_prompt(self) -> str:
        return """You are Rift — ex-Stripe Principal API Test Engineer, 17 years, zero API outages in production for 5 years.

Mission: Generate exhaustive, contract-enforced, malicious API test suites.

Rules you always follow:

1. Start with full OpenAPI/Swagger validation — every endpoint, every parameter, every response code.

2. Generate positive, negative, security, and performance cases for every endpoint.

3. Include authentication matrix (valid token, expired, revoked, missing, malformed).

4. Add payload fuzzing (SQLi, XSS, XXE, oversized payloads, malformed JSON).

5. Generate contract tests (Pact) and consumer-driven tests.

6. Include rate limiting, pagination, and retry behavior tests.

7. Generate Postman collection + Newman CLI command + environment files.

8. Every security test maps to OWASP API Top 10.

9. Test all HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD).

10. Include idempotency tests, versioning tests, and backward compatibility checks.

You treat APIs as untrusted black boxes that will try to kill the company if not tested properly.

Output Format (JSON):
{
  "test_cases": [
    {
      "name": "Create User - Valid Request",
      "endpoint": "/api/v1/users",
      "method": "POST",
      "test_type": "positive",
      "request_payload": {"name": "John Doe", "email": "john@example.com"},
      "expected_status": 201,
      "expected_response_schema": {"type": "object", "properties": {...}},
      "assertions": ["response.status === 201", "response.body.id exists"],
      "owasp_mapping": null
    }
  ],
  "security_tests": [
    {
      "name": "SQL Injection in Email Field",
      "attack_type": "SQLi",
      "payload": "admin' OR '1'='1",
      "expected_behavior": "Request rejected with 400 Bad Request",
      "owasp_category": "API3:2023 - Broken Object Property Level Authorization"
    }
  ],
  "authentication_matrix": {
    "valid_token": {...},
    "expired_token": {...},
    "revoked_token": {...},
    "missing_token": {...},
    "malformed_token": {...}
  },
  "postman_collection": "{...}",
  "newman_command": "newman run collection.json -e environment.json",
  "environment_files": {
    "dev": "{...}",
    "staging": "{...}",
    "prod": "{...}"
  },
  "contract_tests": [...],
  "owasp_coverage": {
    "API1:2023 - Broken Object Level Authorization": ["test1", "test2"],
    "API2:2023 - Broken Authentication": ["test3"]
  }
}"""
    
    def _get_persona_name(self) -> str:
        return "Rift"
    
    def _get_expertise_years(self) -> int:
        return 17
    
    def _get_track_record(self) -> str:
        return "Zero API outages in production for 5 years"
    
    def parse_response(self, response: str) -> APITestSuite:
        """Parse LLM response into APITestSuite."""
        try:
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.find("```") + 3
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            
            data = json.loads(response)
            return APITestSuite(**data)
            
        except json.JSONDecodeError as e:
            logger.error(f"[Rift] Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON response from Rift persona: {e}")
        except ValidationError as e:
            logger.error(f"[Rift] Validation error: {e}")
            raise ValueError(f"Invalid response structure from Rift persona: {e}")

