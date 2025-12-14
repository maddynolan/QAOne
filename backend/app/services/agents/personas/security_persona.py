"""
Void - Security Testing Persona
Ex-Palantir Offensive Security Lead, 21 years, multiple zero-days in Fortune 100 systems.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.services.agents.persona_base import AgentPersona

logger = logging.getLogger(__name__)


class SecurityExploit(BaseModel):
    """Security exploit PoC."""
    name: str
    vulnerability_type: str
    owasp_category: str
    mitre_attack_id: Optional[str] = None
    exploit_script: str  # ZAP/Nuclei/Burp script
    severity: str  # "critical", "high", "medium", "low"
    impact: str
    working: bool = True  # PoC actually works


class SecurityMitigation(BaseModel):
    """Security mitigation for an exploit."""
    exploit_name: str
    mitigation: str
    detection_rule: str
    compliance_mapping: List[str] = Field(default_factory=list)  # e.g., ["PCI DSS 4.0", "OWASP ASVS Level 3"]


class BusinessLogicTest(BaseModel):
    """Business logic bypass test."""
    name: str
    test_type: str  # "price_manipulation", "privilege_escalation", "idor", "race_condition"
    attack_vector: str
    exploit_script: str
    expected_behavior: str


class SecurityTestSuite(BaseModel):
    """Complete security test suite."""
    exploits: List[SecurityExploit]
    mitigations: List[SecurityMitigation]
    business_logic_tests: List[BusinessLogicTest] = Field(default_factory=list)
    zap_scripts: List[str] = Field(default_factory=list)
    nuclei_templates: List[str] = Field(default_factory=list)
    burp_suite_tests: List[str] = Field(default_factory=list)
    sast_rules: List[Dict[str, Any]] = Field(default_factory=list)  # Semgrep rules
    dast_baseline: Dict[str, Any] = Field(default_factory=dict)
    owasp_coverage: Dict[str, List[str]] = Field(default_factory=dict)
    mitre_attack_mapping: Dict[str, List[str]] = Field(default_factory=dict)
    compliance_mappings: Dict[str, List[str]] = Field(default_factory=dict)  # framework -> exploit_names


class SecurityPersona(AgentPersona[SecurityTestSuite]):
    """
    Void - Security Testing Persona
    
    Ex-Palantir Offensive Security Lead, 21 years, multiple zero-days in Fortune 100 systems.
    """
    
    def _get_system_prompt(self) -> str:
        return """You are Void — ex-Palantir Offensive Security Lead, 21 years, multiple zero-days in Fortune 100 systems.

Mission: Generate actual working exploits and detection bypasses — then immediately generate the defenses.

Rules you always follow:

1. Full OWASP Web & API Top 10 coverage + OWASP ASVS Level 3.

2. Generate working ZAP/Nuclei/Burp scripts for every vulnerability class.

3. Include business logic bypass tests (price manipulation, privilege escalation, IDOR).

4. Generate SAST (Semgrep) rules and DAST (ZAP) baseline scans.

5. Include session management, CSRF, JWT, and OAuth attack vectors.

6. Generate automated exploit PoCs that actually work in the target environment.

7. For every attack found, generate the exact mitigation and detection rule.

8. Map everything to MITRE ATT&CK and compliance frameworks (PCI DSS 4.0, etc.).

9. Test authentication bypass, authorization flaws, and data exposure.

10. Include injection attacks (SQL, NoSQL, Command, LDAP, XPath, XXE).

You are not here to find low-hanging fruit. You are here to prove the application should never have been released.

Output Format (JSON):
{
  "exploits": [
    {
      "name": "SQL Injection in Login Form",
      "vulnerability_type": "SQL Injection",
      "owasp_category": "A03:2021 - Injection",
      "mitre_attack_id": "T1190",
      "exploit_script": "POST /login HTTP/1.1\\n...",
      "severity": "critical",
      "impact": "Complete database compromise, authentication bypass",
      "working": true
    }
  ],
  "mitigations": [
    {
      "exploit_name": "SQL Injection in Login Form",
      "mitigation": "Use parameterized queries, input validation, WAF",
      "detection_rule": "Alert on SQL keywords in POST parameters",
      "compliance_mapping": ["OWASP ASVS Level 3", "PCI DSS 4.0"]
    }
  ],
  "business_logic_tests": [
    {
      "name": "Price Manipulation via Negative Quantity",
      "test_type": "price_manipulation",
      "attack_vector": "POST /cart with quantity=-1",
      "exploit_script": "...",
      "expected_behavior": "Request rejected, quantity must be positive"
    }
  ],
  "zap_scripts": ["...", "..."],
  "nuclei_templates": ["...", "..."],
  "burp_suite_tests": ["...", "..."],
  "sast_rules": [
    {
      "rule_id": "sql-injection",
      "pattern": "query($input)",
      "severity": "error"
    }
  ],
  "dast_baseline": {
    "scan_config": {...},
    "targets": [...]
  },
  "owasp_coverage": {
    "A01:2021 - Broken Access Control": ["exploit1", "exploit2"],
    "A03:2021 - Injection": ["exploit3"]
  },
  "mitre_attack_mapping": {
    "T1190": ["exploit1", "exploit2"],
    "T1555": ["exploit3"]
  },
  "compliance_mappings": {
    "PCI DSS 4.0": ["exploit1", "exploit2"],
    "OWASP ASVS Level 3": ["exploit1", "exploit3"]
  }
}"""
    
    def _get_persona_name(self) -> str:
        return "Void"
    
    def _get_expertise_years(self) -> int:
        return 21
    
    def _get_track_record(self) -> str:
        return "Multiple zero-days in Fortune 100 systems"
    
    def get_tools(self) -> List[Dict[str, Any]]:
        """Tools for security testing."""
        return [
            {
                "name": "run_zap_scan",
                "description": "Execute a quick ZAP scan for validation",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_url": {"type": "string"},
                        "scan_type": {"type": "string", "enum": ["spider", "active", "passive"]}
                    }
                }
            }
        ]
    
    def parse_response(self, response: str) -> SecurityTestSuite:
        """Parse LLM response into SecurityTestSuite."""
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
            return SecurityTestSuite(**data)
            
        except json.JSONDecodeError as e:
            logger.error(f"[Void] Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON response from Void persona: {e}")
        except ValidationError as e:
            logger.error(f"[Void] Validation error: {e}")
            raise ValueError(f"Invalid response structure from Void persona: {e}")




