"""
Flowstral Performance Probe Pipeline
Real-time performance metrics collection (Web Vitals, API latency, component timing)
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


class PerformancePipeline:
    """
    Pipeline C: Performance Probe Pipeline
    Collects page-level and component-level performance metrics
    """
    
    def __init__(self):
        pass
    
    async def capture_metrics(
        self,
        url: str,
        page_metrics: Optional[Dict[str, Any]] = None,
        component_metrics: Optional[List[Dict[str, Any]]] = None,
        network_calls: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Capture performance metrics:
        - Page-level: TTFB, DOMContentLoaded, FCP, LCP, CLS, TBT
        - Component-level: Render time, largest element
        - API-level: Latency per endpoint
        """
        snapshot_id = str(uuid4())
        
        # Process page-level metrics
        page_level = self._process_page_metrics(page_metrics or {})
        
        # Process component metrics
        component_timing = self._process_component_metrics(component_metrics or [])
        
        # Process network calls
        network_analysis = self._process_network_calls(network_calls or [])
        
        # Identify bottlenecks
        bottlenecks = self._identify_bottlenecks(page_level, component_timing, network_analysis)
        
        snapshot = {
            "performance_snapshot_id": snapshot_id,
            "url": url,
            "timestamp": datetime.utcnow().isoformat(),
            "page_level": page_level,
            "component_timing": component_timing,
            "network_calls": network_analysis,
            "bottlenecks": bottlenecks,
            "summary": self._generate_summary(page_level, component_timing, network_analysis)
        }
        
        return snapshot
    
    def _process_page_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Process page-level Web Vitals"""
        # Handle both old format (domContentLoaded) and new format (domContentLoaded)
        dom_content_loaded = metrics.get("domContentLoaded") or metrics.get("dom_content_loaded", 0)
        fcp = metrics.get("fcp") or metrics.get("first_contentful_paint", 0)
        lcp = metrics.get("lcp") or metrics.get("largest_contentful_paint", 0)
        cls = metrics.get("cls") or metrics.get("cumulative_layout_shift", 0)
        load_time = metrics.get("loadTime") or metrics.get("load_time", 0)
        
        return {
            "ttfb": metrics.get("ttfb", 0),  # Time to First Byte
            "dom_content_loaded": dom_content_loaded,
            "first_contentful_paint": fcp,  # FCP
            "largest_contentful_paint": lcp,  # LCP
            "cumulative_layout_shift": cls,  # CLS
            "total_blocking_time": metrics.get("tbt", 0),  # TBT
            "first_input_delay": metrics.get("fid", 0),  # FID
            "time_to_interactive": metrics.get("tti", 0),  # TTI
            "load_time": load_time,
            "warnings": self._check_page_metrics_warnings({
                "ttfb": metrics.get("ttfb", 0),
                "fcp": fcp,
                "lcp": lcp,
                "cls": cls,
                "tbt": metrics.get("tbt", 0)
            })
        }
    
    def _check_page_metrics_warnings(self, metrics: Dict[str, Any]) -> List[str]:
        """Check for performance warnings"""
        warnings = []
        
        if metrics.get("lcp", 0) > 2500:
            warnings.append(f"LCP is {metrics.get('lcp')}ms (target: <2500ms)")
        
        if metrics.get("fcp", 0) > 1800:
            warnings.append(f"FCP is {metrics.get('fcp')}ms (target: <1800ms)")
        
        if metrics.get("cls", 0) > 0.1:
            warnings.append(f"CLS is {metrics.get('cls')} (target: <0.1)")
        
        if metrics.get("tbt", 0) > 200:
            warnings.append(f"TBT is {metrics.get('tbt')}ms (target: <200ms)")
        
        if metrics.get("ttfb", 0) > 600:
            warnings.append(f"TTFB is {metrics.get('ttfb')}ms (target: <600ms)")
        
        return warnings
    
    def _process_component_metrics(self, components: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process component-level timing"""
        processed = []
        
        for component in components:
            processed.append({
                "component_id": component.get("id"),
                "component_name": component.get("name"),
                "render_time_ms": component.get("renderTime", 0),
                "mount_time_ms": component.get("mountTime", 0),
                "update_time_ms": component.get("updateTime", 0),
                "is_slow": component.get("renderTime", 0) > 100
            })
        
        # Sort by render time (slowest first)
        processed.sort(key=lambda x: x["render_time_ms"], reverse=True)
        
        return processed
    
    def _process_network_calls(self, calls: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process network API calls"""
        endpoints = {}
        slow_calls = []
        failed_calls = []
        
        for call in calls:
            url = call.get("url", "")
            method = call.get("method", "GET")
            duration = call.get("duration", 0)
            status = call.get("status", 200)
            
            endpoint_key = f"{method} {url}"
            
            if endpoint_key not in endpoints:
                endpoints[endpoint_key] = {
                    "url": url,
                    "method": method,
                    "call_count": 0,
                    "total_duration": 0,
                    "min_duration": duration,
                    "max_duration": duration,
                    "avg_duration": 0,
                    "status_codes": []
                }
            
            endpoint = endpoints[endpoint_key]
            endpoint["call_count"] += 1
            endpoint["total_duration"] += duration
            endpoint["min_duration"] = min(endpoint["min_duration"], duration)
            endpoint["max_duration"] = max(endpoint["max_duration"], duration)
            endpoint["status_codes"].append(status)
            
            # Check for slow calls
            if duration > 1000:
                slow_calls.append({
                    "url": url,
                    "method": method,
                    "duration": duration,
                    "timestamp": call.get("timestamp")
                })
            
            # Check for failed calls
            if status >= 400:
                failed_calls.append({
                    "url": url,
                    "method": method,
                    "status": status,
                    "duration": duration,
                    "timestamp": call.get("timestamp")
                })
        
        # Calculate averages
        for endpoint in endpoints.values():
            endpoint["avg_duration"] = endpoint["total_duration"] / endpoint["call_count"]
        
        return {
            "endpoints": list(endpoints.values()),
            "slow_calls": slow_calls,
            "failed_calls": failed_calls,
            "total_calls": len(calls),
            "total_duration": sum(c.get("duration", 0) for c in calls)
        }
    
    def _identify_bottlenecks(
        self,
        page_level: Dict[str, Any],
        component_timing: List[Dict[str, Any]],
        network_analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Identify performance bottlenecks"""
        bottlenecks = []
        
        # Page-level bottlenecks
        if page_level.get("lcp", 0) > 2500:
            bottlenecks.append({
                "type": "page_level",
                "metric": "LCP",
                "value": page_level.get("lcp"),
                "threshold": 2500,
                "severity": "high",
                "description": "Largest Contentful Paint is too slow",
                "recommendation": "Optimize images, reduce render-blocking resources"
            })
        
        if page_level.get("ttfb", 0) > 600:
            bottlenecks.append({
                "type": "page_level",
                "metric": "TTFB",
                "value": page_level.get("ttfb"),
                "threshold": 600,
                "severity": "high",
                "description": "Time to First Byte is too slow",
                "recommendation": "Optimize server response time, use CDN"
            })
        
        # Component bottlenecks
        slow_components = [c for c in component_timing if c.get("render_time_ms", 0) > 100]
        if slow_components:
            bottlenecks.append({
                "type": "component",
                "metric": "render_time",
                "value": slow_components[0].get("render_time_ms"),
                "threshold": 100,
                "severity": "medium",
                "description": f"{len(slow_components)} components are slow to render",
                "components": [c.get("component_name") for c in slow_components[:5]],
                "recommendation": "Optimize component rendering, use code splitting"
            })
        
        # Network bottlenecks
        slow_endpoints = [e for e in network_analysis.get("endpoints", []) if e.get("avg_duration", 0) > 1000]
        if slow_endpoints:
            bottlenecks.append({
                "type": "network",
                "metric": "api_latency",
                "value": slow_endpoints[0].get("avg_duration"),
                "threshold": 1000,
                "severity": "high",
                "description": f"{len(slow_endpoints)} API endpoints are slow",
                "endpoints": [f"{e.get('method')} {e.get('url')}" for e in slow_endpoints[:5]],
                "recommendation": "Optimize API endpoints, add caching, reduce payload size"
            })
        
        return bottlenecks
    
    def _generate_summary(
        self,
        page_level: Dict[str, Any],
        component_timing: List[Dict[str, Any]],
        network_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate performance summary"""
        return {
            "page_score": self._calculate_page_score(page_level),
            "component_count": len(component_timing),
            "slow_components": len([c for c in component_timing if c.get("is_slow")]),
            "network_calls": network_analysis.get("total_calls", 0),
            "slow_api_calls": len(network_analysis.get("slow_calls", [])),
            "failed_api_calls": len(network_analysis.get("failed_calls", [])),
            "total_warnings": len(page_level.get("warnings", []))
        }
    
    def _calculate_page_score(self, page_level: Dict[str, Any]) -> int:
        """Calculate performance score (0-100)"""
        score = 100
        
        # Deduct points for poor metrics
        if page_level.get("lcp", 0) > 2500:
            score -= 20
        elif page_level.get("lcp", 0) > 4000:
            score -= 40
        
        if page_level.get("fcp", 0) > 1800:
            score -= 15
        
        if page_level.get("cls", 0) > 0.1:
            score -= 15
        
        if page_level.get("tbt", 0) > 200:
            score -= 15
        
        if page_level.get("ttfb", 0) > 600:
            score -= 15
        
        return max(0, score)

