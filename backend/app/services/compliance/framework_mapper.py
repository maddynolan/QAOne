"""
Compliance Framework Mapper
Maps security tests and features to compliance frameworks (PCI DSS, HIPAA, SOC 2, GDPR, ISO 27001).
"""

import logging
from typing import Dict, Any, List, Optional
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class ComplianceFramework(Enum):
    """Supported compliance frameworks"""
    PCI_DSS = "PCI_DSS"
    HIPAA = "HIPAA"
    SOC2 = "SOC2"
    GDPR = "GDPR"
    ISO27001 = "ISO27001"
    NIST = "NIST"
    FEDRAMP = "FEDRAMP"


class ComplianceRequirement:
    """Represents a compliance requirement"""
    def __init__(self, framework: str, requirement_id: str, title: str, description: str):
        self.framework = framework
        self.requirement_id = requirement_id
        self.title = title
        self.description = description


class ComplianceFrameworkMapper:
    """
    Maps security tests and platform features to compliance frameworks.
    Provides compliance reporting and validation.
    """
    
    def __init__(self):
        # Compliance framework knowledge base
        self.framework_requirements = self._load_framework_requirements()
        self.test_to_compliance_map = self._build_test_compliance_map()
    
    def _load_framework_requirements(self) -> Dict[str, List[ComplianceRequirement]]:
        """Load compliance framework requirements"""
        requirements = {
            "PCI_DSS": [
                ComplianceRequirement("PCI_DSS", "6.3.2", "Secure Development", 
                    "Review custom code prior to release to production to identify potential coding vulnerabilities"),
                ComplianceRequirement("PCI_DSS", "6.5", "Secure Coding Practices",
                    "Address common coding vulnerabilities in software-development processes"),
                ComplianceRequirement("PCI_DSS", "11.3", "Penetration Testing",
                    "Perform external penetration testing at least annually and after any significant infrastructure changes"),
            ],
            "HIPAA": [
                ComplianceRequirement("HIPAA", "164.308(a)(1)", "Security Management Process",
                    "Implement policies and procedures to prevent, detect, contain, and correct security violations"),
                ComplianceRequirement("HIPAA", "164.312(a)(1)", "Access Control",
                    "Implement technical policies and procedures for electronic information systems that maintain ePHI"),
                ComplianceRequirement("HIPAA", "164.312(e)(1)", "Transmission Security",
                    "Implement technical security measures to guard against unauthorized access to ePHI"),
            ],
            "SOC2": [
                ComplianceRequirement("SOC2", "CC6.1", "Logical and Physical Access Controls",
                    "The entity implements logical access security software, infrastructure, and architectures over protected information assets"),
                ComplianceRequirement("SOC2", "CC7.2", "System Operations",
                    "The entity monitors system components and the operation of those components"),
                ComplianceRequirement("SOC2", "CC7.4", "System Monitoring",
                    "The entity monitors system components and the operation of those components"),
            ],
            "GDPR": [
                ComplianceRequirement("GDPR", "Article 32", "Security of Processing",
                    "Implement appropriate technical and organizational measures to ensure a level of security"),
                ComplianceRequirement("GDPR", "Article 33", "Breach Notification",
                    "Notify the supervisory authority of a personal data breach without undue delay"),
            ],
            "ISO27001": [
                ComplianceRequirement("ISO27001", "A.9.4.2", "Secure Log-on Procedures",
                    "Where required by the access control policy, access to systems and applications shall be controlled by a secure log-on procedure"),
                ComplianceRequirement("ISO27001", "A.14.2.1", "Secure Development Policy",
                    "Rules for the development of software and systems shall be established and applied"),
            ]
        }
        return requirements
    
    def _build_test_compliance_map(self) -> Dict[str, List[str]]:
        """
        Maps test types and security checks to compliance requirements.
        This is the core mapping logic.
        """
        return {
            # Security tests
            "authentication_test": ["PCI_DSS.6.5", "HIPAA.164.312(a)(1)", "SOC2.CC6.1", "ISO27001.A.9.4.2"],
            "authorization_test": ["PCI_DSS.6.5", "HIPAA.164.312(a)(1)", "SOC2.CC6.1"],
            "encryption_test": ["PCI_DSS.4.1", "HIPAA.164.312(e)(1)", "GDPR.Article32"],
            "sql_injection_test": ["PCI_DSS.6.5", "OWASP_A03"],
            "xss_test": ["PCI_DSS.6.5", "OWASP_A03"],
            "csrf_test": ["PCI_DSS.6.5", "OWASP_A01"],
            "penetration_test": ["PCI_DSS.11.3", "SOC2.CC7.4"],
            "vulnerability_scan": ["PCI_DSS.11.2", "SOC2.CC7.4"],
            
            # Access control tests
            "access_control_test": ["HIPAA.164.312(a)(1)", "SOC2.CC6.1", "ISO27001.A.9.4.2"],
            "session_management_test": ["PCI_DSS.6.5", "SOC2.CC6.1"],
            
            # Data protection tests
            "data_encryption_test": ["HIPAA.164.312(e)(1)", "GDPR.Article32"],
            "pii_handling_test": ["GDPR.Article32", "HIPAA.164.308(a)(1)"],
            
            # Development security
            "secure_coding_test": ["PCI_DSS.6.3.2", "ISO27001.A.14.2.1"],
            "code_review_test": ["PCI_DSS.6.3.2"],
            
            # Monitoring and logging
            "audit_log_test": ["SOC2.CC7.4", "HIPAA.164.308(a)(1)"],
            "monitoring_test": ["SOC2.CC7.2", "SOC2.CC7.4"],
        }
    
    def map_test_to_compliance(
        self,
        test_type: str,
        test_name: str,
        test_description: str
    ) -> List[Dict[str, Any]]:
        """
        Map a test to compliance requirements.
        
        Args:
            test_type: Type of test (e.g., "authentication_test", "sql_injection_test")
            test_name: Test name
            test_description: Test description
            
        Returns:
            List of compliance requirement mappings
        """
        compliance_mappings = []
        
        # Get direct mappings
        requirement_ids = self.test_to_compliance_map.get(test_type, [])
        
        for req_id in requirement_ids:
            framework, req_num = req_id.split(".", 1)
            requirement = self._find_requirement(framework, req_num)
            
            if requirement:
                compliance_mappings.append({
                    "framework": framework,
                    "requirement_id": req_id,
                    "requirement_title": requirement.title,
                    "requirement_description": requirement.description,
                    "test_name": test_name,
                    "test_description": test_description,
                    "validation_statement": f"Test '{test_name}' validates {framework} Requirement {req_num}: {requirement.title}"
                })
        
        # Also check test description for compliance keywords
        description_lower = test_description.lower()
        if "encryption" in description_lower or "encrypt" in description_lower:
            compliance_mappings.extend(self._add_encryption_compliance(test_name, test_description))
        if "access" in description_lower or "authorization" in description_lower:
            compliance_mappings.extend(self._add_access_compliance(test_name, test_description))
        if "authentication" in description_lower or "login" in description_lower:
            compliance_mappings.extend(self._add_auth_compliance(test_name, test_description))
        
        return compliance_mappings
    
    def _find_requirement(self, framework: str, requirement_id: str) -> Optional[ComplianceRequirement]:
        """Find a compliance requirement by framework and ID"""
        requirements = self.framework_requirements.get(framework, [])
        for req in requirements:
            if req.requirement_id == requirement_id:
                return req
        return None
    
    def _add_encryption_compliance(self, test_name: str, test_description: str) -> List[Dict[str, Any]]:
        """Add encryption-related compliance mappings"""
        return [{
            "framework": "HIPAA",
            "requirement_id": "HIPAA.164.312(e)(1)",
            "requirement_title": "Transmission Security",
            "validation_statement": f"Test '{test_name}' validates HIPAA transmission security requirements"
        }, {
            "framework": "GDPR",
            "requirement_id": "GDPR.Article32",
            "requirement_title": "Security of Processing",
            "validation_statement": f"Test '{test_name}' validates GDPR security of processing requirements"
        }]
    
    def _add_access_compliance(self, test_name: str, test_description: str) -> List[Dict[str, Any]]:
        """Add access control-related compliance mappings"""
        return [{
            "framework": "HIPAA",
            "requirement_id": "HIPAA.164.312(a)(1)",
            "requirement_title": "Access Control",
            "validation_statement": f"Test '{test_name}' validates HIPAA access control requirements"
        }, {
            "framework": "SOC2",
            "requirement_id": "SOC2.CC6.1",
            "requirement_title": "Logical and Physical Access Controls",
            "validation_statement": f"Test '{test_name}' validates SOC2 access control requirements"
        }]
    
    def _add_auth_compliance(self, test_name: str, test_description: str) -> List[Dict[str, Any]]:
        """Add authentication-related compliance mappings"""
        return [{
            "framework": "PCI_DSS",
            "requirement_id": "PCI_DSS.6.5",
            "requirement_title": "Secure Coding Practices",
            "validation_statement": f"Test '{test_name}' validates PCI DSS secure coding practices"
        }, {
            "framework": "ISO27001",
            "requirement_id": "ISO27001.A.9.4.2",
            "requirement_title": "Secure Log-on Procedures",
            "validation_statement": f"Test '{test_name}' validates ISO27001 secure log-on procedures"
        }]
    
    def generate_compliance_report(
        self,
        test_runs: List[Dict[str, Any]],
        frameworks: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate compliance report from test run results.
        
        Args:
            test_runs: List of test run results
            frameworks: Optional list of frameworks to include (default: all)
            
        Returns:
            Compliance report dictionary
        """
        if frameworks is None:
            frameworks = [f.value for f in ComplianceFramework]
        
        report = {
            "report_date": datetime.utcnow().isoformat(),
            "frameworks": {},
            "summary": {
                "total_tests": len(test_runs),
                "passed": 0,
                "failed": 0,
                "compliance_coverage": {}
            }
        }
        
        # Process each framework
        for framework in frameworks:
            framework_report = {
                "framework": framework,
                "requirements_validated": [],
                "tests_passed": 0,
                "tests_failed": 0,
                "compliance_percentage": 0.0
            }
            
            # Map tests to compliance
            for test_run in test_runs:
                test_type = test_run.get("test_type", "")
                test_name = test_run.get("test_name", "")
                test_status = test_run.get("status", "unknown")
                
                mappings = self.map_test_to_compliance(test_type, test_name, test_run.get("description", ""))
                
                for mapping in mappings:
                    if mapping["framework"] == framework:
                        framework_report["requirements_validated"].append({
                            "requirement_id": mapping["requirement_id"],
                            "requirement_title": mapping["requirement_title"],
                            "test_name": test_name,
                            "test_status": test_status,
                            "validation_statement": mapping["validation_statement"]
                        })
                        
                        if test_status == "passed":
                            framework_report["tests_passed"] += 1
                        else:
                            framework_report["tests_failed"] += 1
            
            # Calculate compliance percentage
            total_tests = framework_report["tests_passed"] + framework_report["tests_failed"]
            if total_tests > 0:
                framework_report["compliance_percentage"] = (
                    framework_report["tests_passed"] / total_tests * 100
                )
            
            report["frameworks"][framework] = framework_report
            report["summary"]["compliance_coverage"][framework] = len(framework_report["requirements_validated"])
        
        return report


# Global instance
_compliance_mapper = None

def get_compliance_mapper() -> ComplianceFrameworkMapper:
    """Get or create global ComplianceFrameworkMapper instance"""
    global _compliance_mapper
    if _compliance_mapper is None:
        _compliance_mapper = ComplianceFrameworkMapper()
    return _compliance_mapper

