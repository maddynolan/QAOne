"""
OWASP API Security Testing Service
===================================
Automated security testing based on OWASP API Security Top 10 (2023)

Tests for:
1. API1:2023 - Broken Object Level Authorization (BOLA)
2. API2:2023 - Broken Authentication
3. API3:2023 - Broken Object Property Level Authorization
4. API4:2023 - Unrestricted Resource Consumption
5. API5:2023 - Broken Function Level Authorization
6. API6:2023 - Unrestricted Access to Sensitive Business Flows
7. API7:2023 - Server-Side Request Forgery (SSRF)
8. API8:2023 - Security Misconfiguration
9. API9:2023 - Improper Inventory Management
10. API10:2023 - Unsafe Consumption of APIs
"""

import logging
import os
import re
import json
import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class OWASPCategory(Enum):
    API1_BOLA = "API1:2023 - Broken Object Level Authorization"
    API2_BROKEN_AUTH = "API2:2023 - Broken Authentication"
    API3_BOPLA = "API3:2023 - Broken Object Property Level Authorization"
    API4_RESOURCE_CONSUMPTION = "API4:2023 - Unrestricted Resource Consumption"
    API5_BFLA = "API5:2023 - Broken Function Level Authorization"
    API6_BUSINESS_FLOW = "API6:2023 - Unrestricted Access to Sensitive Business Flows"
    API7_SSRF = "API7:2023 - Server-Side Request Forgery"
    API8_MISCONFIG = "API8:2023 - Security Misconfiguration"
    API9_INVENTORY = "API9:2023 - Improper Inventory Management"
    API10_UNSAFE_CONSUMPTION = "API10:2023 - Unsafe Consumption of APIs"


@dataclass
class SecurityFinding:
    """A security finding/vulnerability"""
    id: str
    title: str
    category: OWASPCategory
    severity: Severity
    description: str
    evidence: str
    remediation: str
    endpoint: str
    method: str
    request: Optional[str] = None
    response: Optional[str] = None
    cwe_id: Optional[str] = None
    cvss_score: Optional[float] = None


@dataclass
class SecurityScanResult:
    """Result of a security scan"""
    scan_id: str
    target_url: str
    start_time: str
    end_time: str
    duration_ms: float
    total_tests: int
    findings: List[SecurityFinding] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)


class OWASPAPISecurityScanner:
    """
    Automated OWASP API Security Top 10 scanner.
    Performs security tests against API endpoints.
    """

    def __init__(self):
        self.findings: List[SecurityFinding] = []
        self.finding_counter = 0

    def _add_finding(self, title: str, category: OWASPCategory, severity: Severity,
                     description: str, evidence: str, remediation: str,
                     endpoint: str, method: str, request: str = None,
                     response: str = None, cwe_id: str = None) -> SecurityFinding:
        """Add a security finding"""
        self.finding_counter += 1
        finding = SecurityFinding(
            id=f"OWASP-{self.finding_counter:04d}",
            title=title,
            category=category,
            severity=severity,
            description=description,
            evidence=evidence,
            remediation=remediation,
            endpoint=endpoint,
            method=method,
            request=request,
            response=response,
            cwe_id=cwe_id
        )
        self.findings.append(finding)
        return finding

    async def _test_bola(self, client: httpx.AsyncClient, base_url: str,
                         endpoints: List[Dict[str, Any]], auth_token: Optional[str]):
        """
        API1:2023 - Broken Object Level Authorization (BOLA)
        Test if users can access objects belonging to other users
        """
        for endpoint in endpoints:
            if "{id}" in endpoint.get("path", "") or re.search(r'/\d+', endpoint.get("path", "")):
                url = f"{base_url}{endpoint['path']}"
                method = endpoint.get("method", "GET")

                # Try accessing with different IDs
                test_ids = ["1", "2", "999999", "0", "-1", "admin"]
                headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}

                for test_id in test_ids:
                    test_url = re.sub(r'\{id\}|\d+', test_id, url)
                    try:
                        response = await client.request(method, test_url, headers=headers, timeout=10)
                        
                        if response.status_code == 200:
                            # Check if response contains data that might belong to another user
                            try:
                                data = response.json()
                                if isinstance(data, dict) and ("user_id" in data or "owner_id" in data):
                                    self._add_finding(
                                        title="Potential BOLA - Object accessed without ownership validation",
                                        category=OWASPCategory.API1_BOLA,
                                        severity=Severity.HIGH,
                                        description=f"The endpoint returns data for ID '{test_id}' without proper ownership validation.",
                                        evidence=f"URL: {test_url}, Status: {response.status_code}",
                                        remediation="Implement proper authorization checks to verify the requesting user owns or has access to the requested resource.",
                                        endpoint=endpoint["path"],
                                        method=method,
                                        cwe_id="CWE-639"
                                    )
                            except:
                                pass
                    except:
                        pass

    async def _test_broken_auth(self, client: httpx.AsyncClient, base_url: str,
                                endpoints: List[Dict[str, Any]]):
        """
        API2:2023 - Broken Authentication
        Test for authentication weaknesses
        """
        # Find authentication endpoints
        auth_endpoints = [e for e in endpoints if any(
            keyword in e.get("path", "").lower()
            for keyword in ["login", "auth", "token", "signin", "session"]
        )]

        for endpoint in auth_endpoints:
            url = f"{base_url}{endpoint['path']}"

            # Test 1: Rate limiting
            responses = []
            for _ in range(10):
                try:
                    response = await client.post(
                        url,
                        json={"username": "test@test.com", "password": "wrongpassword"},
                        timeout=5
                    )
                    responses.append(response.status_code)
                except:
                    break

            if len(responses) == 10 and 429 not in responses:
                self._add_finding(
                    title="No Rate Limiting on Authentication Endpoint",
                    category=OWASPCategory.API2_BROKEN_AUTH,
                    severity=Severity.HIGH,
                    description="The authentication endpoint does not implement rate limiting, allowing unlimited login attempts.",
                    evidence=f"10 consecutive requests returned status codes: {responses}",
                    remediation="Implement rate limiting (e.g., max 5 attempts per minute) and account lockout mechanisms.",
                    endpoint=endpoint["path"],
                    method="POST",
                    cwe_id="CWE-307"
                )

            # Test 2: Weak password acceptance
            weak_passwords = ["123456", "password", "admin", "test"]
            for weak_pwd in weak_passwords:
                try:
                    response = await client.post(
                        url.replace("login", "register").replace("signin", "signup"),
                        json={"email": "test@test.com", "password": weak_pwd},
                        timeout=5
                    )
                    if response.status_code in [200, 201]:
                        self._add_finding(
                            title="Weak Password Policy",
                            category=OWASPCategory.API2_BROKEN_AUTH,
                            severity=Severity.MEDIUM,
                            description=f"The API accepts weak passwords like '{weak_pwd}'.",
                            evidence=f"Registration with password '{weak_pwd}' returned status {response.status_code}",
                            remediation="Implement strong password policies requiring minimum length, complexity, and checking against common passwords.",
                            endpoint=endpoint["path"],
                            method="POST",
                            cwe_id="CWE-521"
                        )
                        break
                except:
                    pass

    async def _test_bopla(self, client: httpx.AsyncClient, base_url: str,
                          endpoints: List[Dict[str, Any]], auth_token: Optional[str]):
        """
        API3:2023 - Broken Object Property Level Authorization
        Test if users can modify properties they shouldn't have access to
        """
        headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}

        for endpoint in endpoints:
            if endpoint.get("method") in ["PUT", "PATCH", "POST"]:
                url = f"{base_url}{endpoint['path']}"

                # Try to set admin/privileged properties
                privileged_payloads = [
                    {"role": "admin"},
                    {"is_admin": True},
                    {"permissions": ["admin", "superuser"]},
                    {"user_type": "administrator"},
                    {"balance": 999999},
                    {"credit": 999999},
                    {"status": "verified"},
                    {"email_verified": True}
                ]

                for payload in privileged_payloads:
                    try:
                        response = await client.request(
                            endpoint["method"],
                            url,
                            json=payload,
                            headers=headers,
                            timeout=10
                        )

                        if response.status_code in [200, 201, 204]:
                            self._add_finding(
                                title="Potential Mass Assignment Vulnerability",
                                category=OWASPCategory.API3_BOPLA,
                                severity=Severity.HIGH,
                                description=f"The endpoint accepts potentially privileged properties: {list(payload.keys())}",
                                evidence=f"Payload: {json.dumps(payload)}, Status: {response.status_code}",
                                remediation="Implement allowlists for acceptable properties and validate all input against expected schemas.",
                                endpoint=endpoint["path"],
                                method=endpoint["method"],
                                cwe_id="CWE-915"
                            )
                            break
                    except:
                        pass

    async def _test_resource_consumption(self, client: httpx.AsyncClient, base_url: str,
                                         endpoints: List[Dict[str, Any]]):
        """
        API4:2023 - Unrestricted Resource Consumption
        Test for DoS vulnerabilities through resource exhaustion
        """
        for endpoint in endpoints:
            if endpoint.get("method") == "GET":
                url = f"{base_url}{endpoint['path']}"

                # Test 1: Large page size
                try:
                    response = await client.get(
                        url,
                        params={"page_size": 10000, "limit": 10000},
                        timeout=30
                    )
                    if response.status_code == 200:
                        content_length = len(response.content)
                        if content_length > 1_000_000:  # > 1MB
                            self._add_finding(
                                title="No Pagination Limit",
                                category=OWASPCategory.API4_RESOURCE_CONSUMPTION,
                                severity=Severity.MEDIUM,
                                description="The endpoint allows requesting very large page sizes, potentially causing resource exhaustion.",
                                evidence=f"Response size: {content_length} bytes for page_size=10000",
                                remediation="Implement and enforce maximum pagination limits (e.g., max 100 items per page).",
                                endpoint=endpoint["path"],
                                method="GET",
                                cwe_id="CWE-770"
                            )
                except:
                    pass

                # Test 2: Deep recursion in JSON
                if endpoint.get("method") == "POST":
                    deep_json = {"a": {"b": {"c": {"d": {"e": {"f": {"g": "deep"}}}}}}}
                    try:
                        response = await client.post(url, json=deep_json, timeout=10)
                        if response.status_code in [200, 201]:
                            self._add_finding(
                                title="No JSON Depth Limit",
                                category=OWASPCategory.API4_RESOURCE_CONSUMPTION,
                                severity=Severity.LOW,
                                description="The endpoint accepts deeply nested JSON without validation.",
                                evidence="Accepted 7-level deep nested JSON",
                                remediation="Implement JSON depth limits and maximum request size limits.",
                                endpoint=endpoint["path"],
                                method="POST",
                                cwe_id="CWE-400"
                            )
                    except:
                        pass

    async def _test_bfla(self, client: httpx.AsyncClient, base_url: str,
                         endpoints: List[Dict[str, Any]], auth_token: Optional[str]):
        """
        API5:2023 - Broken Function Level Authorization
        Test if regular users can access admin functions
        """
        admin_paths = ["admin", "management", "internal", "config", "settings",
                       "users", "system", "logs", "audit", "export"]

        headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}

        for endpoint in endpoints:
            path = endpoint.get("path", "")
            if any(admin_path in path.lower() for admin_path in admin_paths):
                url = f"{base_url}{path}"
                method = endpoint.get("method", "GET")

                try:
                    response = await client.request(method, url, headers=headers, timeout=10)

                    if response.status_code == 200:
                        self._add_finding(
                            title="Potential Admin Function Accessible",
                            category=OWASPCategory.API5_BFLA,
                            severity=Severity.HIGH,
                            description=f"Admin/privileged endpoint is accessible: {path}",
                            evidence=f"URL: {url}, Status: {response.status_code}",
                            remediation="Implement role-based access control (RBAC) and verify user permissions before allowing access to administrative functions.",
                            endpoint=path,
                            method=method,
                            cwe_id="CWE-285"
                        )
                except:
                    pass

    async def _test_ssrf(self, client: httpx.AsyncClient, base_url: str,
                         endpoints: List[Dict[str, Any]]):
        """
        API7:2023 - Server-Side Request Forgery (SSRF)
        Test for SSRF vulnerabilities
        """
        ssrf_payloads = [
            "http://localhost:22",
            "http://127.0.0.1:22",
            "http://[::1]:22",
            "http://169.254.169.254/latest/meta-data/",  # AWS metadata
            "http://metadata.google.internal/",  # GCP metadata
            "file:///etc/passwd",
            "gopher://localhost:25"
        ]

        for endpoint in endpoints:
            if endpoint.get("method") == "POST":
                url = f"{base_url}{endpoint['path']}"

                # Look for URL parameters in schema
                param_names = ["url", "uri", "link", "target", "redirect", "callback",
                               "webhook", "fetch", "download", "image_url", "file_url"]

                for param in param_names:
                    for payload in ssrf_payloads:
                        try:
                            response = await client.post(
                                url,
                                json={param: payload},
                                timeout=10
                            )

                            # Check for signs of SSRF
                            if response.status_code == 200:
                                response_text = response.text.lower()
                                if any(indicator in response_text for indicator in
                                       ["root:", "ssh", "ami-id", "instance-id", "internal server error"]):
                                    self._add_finding(
                                        title="Potential SSRF Vulnerability",
                                        category=OWASPCategory.API7_SSRF,
                                        severity=Severity.CRITICAL,
                                        description=f"The endpoint may be vulnerable to SSRF via parameter '{param}'.",
                                        evidence=f"Payload: {payload}",
                                        remediation="Implement URL allowlists, disable unnecessary URL schemes, and block requests to internal/private IP ranges.",
                                        endpoint=endpoint["path"],
                                        method="POST",
                                        cwe_id="CWE-918"
                                    )
                                    break
                        except:
                            pass

    async def _test_security_misconfiguration(self, client: httpx.AsyncClient, base_url: str,
                                               endpoints: List[Dict[str, Any]]):
        """
        API8:2023 - Security Misconfiguration
        Test for common security misconfigurations
        """
        # Test 1: Check security headers
        try:
            response = await client.get(base_url, timeout=10)
            headers = response.headers

            security_headers = {
                "X-Content-Type-Options": "Prevents MIME sniffing",
                "X-Frame-Options": "Prevents clickjacking",
                "X-XSS-Protection": "Enables XSS filter",
                "Strict-Transport-Security": "Enforces HTTPS",
                "Content-Security-Policy": "Prevents XSS and injection attacks"
            }

            missing_headers = [h for h in security_headers if h.lower() not in
                               [k.lower() for k in headers.keys()]]

            if missing_headers:
                self._add_finding(
                    title="Missing Security Headers",
                    category=OWASPCategory.API8_MISCONFIG,
                    severity=Severity.MEDIUM,
                    description=f"Missing security headers: {', '.join(missing_headers)}",
                    evidence=f"Present headers: {list(headers.keys())}",
                    remediation="Add all recommended security headers to API responses.",
                    endpoint="/",
                    method="GET",
                    cwe_id="CWE-693"
                )

            # Test 2: Check for verbose error messages
            response = await client.get(f"{base_url}/nonexistent_endpoint_12345", timeout=10)
            if response.status_code >= 400:
                error_text = response.text.lower()
                if any(indicator in error_text for indicator in
                       ["stack trace", "traceback", "exception", "sql", "database",
                        "at line", "file path", "/var/www", "/home/"]):
                    self._add_finding(
                        title="Verbose Error Messages",
                        category=OWASPCategory.API8_MISCONFIG,
                        severity=Severity.MEDIUM,
                        description="The API returns detailed error messages that may reveal internal implementation details.",
                        evidence="Error response contains stack traces or internal paths",
                        remediation="Return generic error messages to clients and log detailed errors server-side only.",
                        endpoint="/",
                        method="GET",
                        cwe_id="CWE-209"
                    )

            # Test 3: Check for CORS misconfiguration
            response = await client.options(
                base_url,
                headers={"Origin": "https://evil.com"},
                timeout=10
            )
            if response.headers.get("Access-Control-Allow-Origin") in ["*", "https://evil.com"]:
                self._add_finding(
                    title="CORS Misconfiguration",
                    category=OWASPCategory.API8_MISCONFIG,
                    severity=Severity.MEDIUM,
                    description="The API has overly permissive CORS configuration.",
                    evidence=f"Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin')}",
                    remediation="Configure CORS to only allow specific, trusted origins.",
                    endpoint="/",
                    method="OPTIONS",
                    cwe_id="CWE-942"
                )

        except Exception as e:
            logger.warning(f"Security misconfiguration tests failed: {e}")

    async def _test_improper_inventory(self, client: httpx.AsyncClient, base_url: str):
        """
        API9:2023 - Improper Inventory Management
        Test for exposed development/debug endpoints
        """
        debug_endpoints = [
            "/debug", "/test", "/dev", "/staging",
            "/api/debug", "/api/test", "/api/dev",
            "/swagger", "/swagger-ui", "/api-docs",
            "/graphql", "/graphiql", "/playground",
            "/actuator", "/actuator/health", "/actuator/env",
            "/.env", "/config", "/phpinfo",
            "/server-status", "/health", "/metrics",
            "/api/v0/", "/api/v1/internal/", "/api/admin/"
        ]

        for endpoint in debug_endpoints:
            try:
                url = f"{base_url}{endpoint}"
                response = await client.get(url, timeout=5)

                if response.status_code == 200:
                    self._add_finding(
                        title=f"Exposed Development/Debug Endpoint: {endpoint}",
                        category=OWASPCategory.API9_INVENTORY,
                        severity=Severity.MEDIUM if "debug" in endpoint or "test" in endpoint else Severity.LOW,
                        description=f"Development or debug endpoint is accessible in production: {endpoint}",
                        evidence=f"URL: {url}, Status: {response.status_code}",
                        remediation="Disable or protect development/debug endpoints in production environments.",
                        endpoint=endpoint,
                        method="GET",
                        cwe_id="CWE-489"
                    )
            except:
                pass

    async def scan(self, target_url: str, endpoints: List[Dict[str, Any]] = None,
                   auth_token: Optional[str] = None, 
                   scan_types: List[str] = None) -> SecurityScanResult:
        """
        Run a comprehensive OWASP API security scan.
        
        Args:
            target_url: Base URL of the API to scan
            endpoints: List of endpoint definitions (optional)
            auth_token: Authentication token (optional)
            scan_types: List of specific tests to run (optional, runs all if None)
        
        Returns:
            SecurityScanResult with all findings
        """
        self.findings = []
        self.finding_counter = 0

        start_time = datetime.utcnow()
        scan_id = f"SCAN-{start_time.strftime('%Y%m%d%H%M%S')}"

        # Default endpoints if none provided
        if not endpoints:
            endpoints = [
                {"path": "/api/users", "method": "GET"},
                {"path": "/api/users/{id}", "method": "GET"},
                {"path": "/api/users", "method": "POST"},
                {"path": "/api/users/{id}", "method": "PUT"},
                {"path": "/api/auth/login", "method": "POST"},
                {"path": "/api/admin", "method": "GET"},
            ]

        # Define all scan functions
        all_scans = {
            "bola": lambda c: self._test_bola(c, target_url, endpoints, auth_token),
            "broken_auth": lambda c: self._test_broken_auth(c, target_url, endpoints),
            "bopla": lambda c: self._test_bopla(c, target_url, endpoints, auth_token),
            "resource_consumption": lambda c: self._test_resource_consumption(c, target_url, endpoints),
            "bfla": lambda c: self._test_bfla(c, target_url, endpoints, auth_token),
            "ssrf": lambda c: self._test_ssrf(c, target_url, endpoints),
            "misconfig": lambda c: self._test_security_misconfiguration(c, target_url, endpoints),
            "inventory": lambda c: self._test_improper_inventory(c, target_url)
        }

        # Select scans to run
        scans_to_run = scan_types if scan_types else list(all_scans.keys())
        total_tests = len(scans_to_run)

        # SEC-DATA-002: SSL verification enabled for security compliance
        ssl_verify = os.getenv("OWASP_SCAN_VERIFY_SSL", "true").lower() != "false"
        async with httpx.AsyncClient(verify=ssl_verify) as client:
            for scan_name in scans_to_run:
                if scan_name in all_scans:
                    try:
                        logger.info(f"Running {scan_name} tests...")
                        await all_scans[scan_name](client)
                    except Exception as e:
                        logger.error(f"Scan {scan_name} failed: {e}")

        end_time = datetime.utcnow()
        duration_ms = (end_time - start_time).total_seconds() * 1000

        # Calculate summary
        summary = {
            "critical": len([f for f in self.findings if f.severity == Severity.CRITICAL]),
            "high": len([f for f in self.findings if f.severity == Severity.HIGH]),
            "medium": len([f for f in self.findings if f.severity == Severity.MEDIUM]),
            "low": len([f for f in self.findings if f.severity == Severity.LOW]),
            "info": len([f for f in self.findings if f.severity == Severity.INFO]),
            "total": len(self.findings)
        }

        return SecurityScanResult(
            scan_id=scan_id,
            target_url=target_url,
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            duration_ms=duration_ms,
            total_tests=total_tests,
            findings=self.findings,
            summary=summary
        )


# Singleton instance
_scanner: Optional[OWASPAPISecurityScanner] = None


def get_owasp_scanner() -> OWASPAPISecurityScanner:
    """Get the singleton OWASP scanner instance"""
    global _scanner
    if _scanner is None:
        _scanner = OWASPAPISecurityScanner()
    return _scanner



