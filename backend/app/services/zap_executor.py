"""
OWASP ZAP Security Test Executor
Executes security scans using ZAP and processes results.
"""

import os
import json
import subprocess
import time
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
from pathlib import Path
import aiohttp

logger = logging.getLogger(__name__)


class ZAPExecutor:
    """
    Executor for OWASP ZAP security tests.
    Runs ZAP scans and processes security findings.
    """

    def __init__(
        self,
        zap_url: Optional[str] = None,
        zap_api_key: Optional[str] = None
    ):
        """
        Initialize ZAP executor.
        
        Args:
            zap_url: ZAP API URL (default: http://localhost:8080)
            zap_api_key: ZAP API key (optional)
        """
        self.zap_url = zap_url or os.getenv("ZAP_URL", "http://localhost:8080")
        self.zap_api_key = zap_api_key or os.getenv("ZAP_API_KEY", "")
        self.results_dir = Path(os.getenv("ZAP_RESULTS_DIR", "/tmp/zap-results"))
        self.results_dir.mkdir(parents=True, exist_ok=True)
        self.session = None

    async def initialize(self):
        """Initialize ZAP session"""
        if not self.session:
            self.session = aiohttp.ClientSession()

    async def execute_scan(
        self,
        target_url: str,
        scan_type: str = "spider",
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a ZAP security scan.
        
        Args:
            target_url: URL to scan
            scan_type: Type of scan (spider, ajax_spider, active_scan, passive_scan)
            options: Scan options
            
        Returns:
            Scan results with findings
        """
        await self.initialize()
        options = options or {}

        try:
            # Start ZAP session
            context_id = await self._create_context(target_url)

            # Spider scan
            if scan_type in ["spider", "ajax_spider"]:
                scan_id = await self._start_spider_scan(target_url, context_id, scan_type == "ajax_spider")
                await self._wait_for_scan_completion(scan_id, "spider")

            # Passive scan (always runs)
            await self._run_passive_scan()

            # Active scan (if requested)
            if scan_type == "active_scan" or options.get("active_scan", False):
                active_scan_id = await self._start_active_scan(target_url, context_id)
                await self._wait_for_scan_completion(active_scan_id, "active")

            # Get results
            alerts = await self._get_alerts()
            findings = self._process_alerts(alerts)

            # Generate report
            report = await self._generate_report(target_url, findings)

            return {
                "status": "success",
                "target_url": target_url,
                "scan_type": scan_type,
                "findings": findings,
                "summary": {
                    "total_alerts": len(alerts),
                    "high_risk": len([f for f in findings if f["risk"] == "High"]),
                    "medium_risk": len([f for f in findings if f["risk"] == "Medium"]),
                    "low_risk": len([f for f in findings if f["risk"] == "Low"]),
                    "informational": len([f for f in findings if f["risk"] == "Informational"])
                },
                "report": report
            }

        except Exception as e:
            logger.error(f"Error executing ZAP scan: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

    async def _create_context(self, target_url: str) -> str:
        """Create a ZAP context for the scan"""
        url = f"{self.zap_url}/JSON/context/action/newContext/"
        params = {"contextName": f"scan_{int(time.time())}"}
        if self.zap_api_key:
            params["apikey"] = self.zap_api_key

        async with self.session.get(url, params=params) as response:
            data = await response.json()
            return data.get("contextId", "")

    async def _start_spider_scan(
        self,
        target_url: str,
        context_id: str,
        ajax: bool = False
    ) -> str:
        """Start a spider scan"""
        endpoint = "/JSON/spider/action/scan/" if not ajax else "/JSON/ajaxSpider/action/scan/"
        url = f"{self.zap_url}{endpoint}"
        params = {"url": target_url}
        if context_id:
            params["contextId"] = context_id
        if self.zap_api_key:
            params["apikey"] = self.zap_api_key

        async with self.session.get(url, params=params) as response:
            data = await response.json()
            return data.get("scan", "")

    async def _start_active_scan(self, target_url: str, context_id: str) -> str:
        """Start an active scan"""
        url = f"{self.zap_url}/JSON/ascan/action/scan/"
        params = {"url": target_url}
        if context_id:
            params["contextId"] = context_id
        if self.zap_api_key:
            params["apikey"] = self.zap_api_key

        async with self.session.get(url, params=params) as response:
            data = await response.json()
            return data.get("scan", "")

    async def _run_passive_scan(self):
        """Run passive scan (records traffic)"""
        # Passive scan runs automatically, just wait a bit
        await asyncio.sleep(5)

    async def _wait_for_scan_completion(self, scan_id: str, scan_type: str, timeout: int = 300):
        """Wait for scan to complete"""
        endpoint = "/JSON/spider/view/status/" if scan_type == "spider" else "/JSON/ascan/view/status/"
        url = f"{self.zap_url}{endpoint}"
        params = {"scanId": scan_id}
        if self.zap_api_key:
            params["apikey"] = self.zap_api_key

        start_time = time.time()
        while time.time() - start_time < timeout:
            async with self.session.get(url, params=params) as response:
                data = await response.json()
                status = int(data.get("status", 100))
                
                if status == 100:
                    # Scan in progress
                    await asyncio.sleep(2)
                else:
                    # Scan complete
                    return

        raise TimeoutError(f"Scan {scan_id} did not complete within {timeout}s")

    async def _get_alerts(self) -> List[Dict[str, Any]]:
        """Get security alerts from ZAP"""
        url = f"{self.zap_url}/JSON/core/view/alerts/"
        params = {}
        if self.zap_api_key:
            params["apikey"] = self.zap_api_key

        async with self.session.get(url, params=params) as response:
            data = await response.json()
            return data.get("alerts", [])

    def _process_alerts(self, alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process and categorize alerts"""
        findings = []

        risk_map = {
            "High": 3,
            "Medium": 2,
            "Low": 1,
            "Informational": 0
        }

        for alert in alerts:
            finding = {
                "id": alert.get("pluginId", ""),
                "name": alert.get("name", ""),
                "risk": alert.get("risk", "Informational"),
                "confidence": alert.get("confidence", "Medium"),
                "description": alert.get("description", ""),
                "solution": alert.get("solution", ""),
                "url": alert.get("url", ""),
                "cwe_id": alert.get("cweid", ""),
                "wasc_id": alert.get("wascid", ""),
                "evidence": alert.get("evidence", "")
            }

            findings.append(finding)

        # Sort by risk (High first)
        findings.sort(key=lambda f: risk_map.get(f["risk"], 0), reverse=True)

        return findings

    async def _generate_report(
        self,
        target_url: str,
        findings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate security report"""
        report_file = self.results_dir / f"zap_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            "target_url": target_url,
            "scan_date": datetime.utcnow().isoformat(),
            "findings": findings,
            "summary": {
                "total_findings": len(findings),
                "high_risk": len([f for f in findings if f["risk"] == "High"]),
                "medium_risk": len([f for f in findings if f["risk"] == "Medium"]),
                "low_risk": len([f for f in findings if f["risk"] == "Low"]),
                "informational": len([f for f in findings if f["risk"] == "Informational"])
            }
        }

        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        return {
            "file": str(report_file),
            "summary": report["summary"]
        }

    async def cleanup(self):
        """Clean up resources"""
        if self.session:
            await self.session.close()


# Global instance
zap_executor = ZAPExecutor()

