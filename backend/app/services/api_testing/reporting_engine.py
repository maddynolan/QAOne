"""
Reporting and Analytics Engine
Comprehensive test reporting with trends, metrics, and visualizations
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


class ReportingEngine:
    """
    Comprehensive reporting and analytics engine
    Generates detailed reports, trends, and metrics
    """
    
    def __init__(self):
        self.reports: Dict[str, Any] = {}
    
    def generate_execution_report(
        self,
        execution_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate comprehensive execution report
        
        Args:
            execution_results: Test execution results
            
        Returns:
            Detailed report
        """
        report_id = execution_results.get("execution_id", "unknown")
        
        report = {
            "report_id": report_id,
            "execution_id": execution_results.get("execution_id"),
            "generated_at": datetime.utcnow().isoformat(),
            "execution_summary": {
                "mode": execution_results.get("mode"),
                "start_time": execution_results.get("start_time"),
                "end_time": execution_results.get("end_time"),
                "duration_seconds": self._calculate_duration(
                    execution_results.get("start_time"),
                    execution_results.get("end_time")
                )
            },
            "test_summary": execution_results.get("summary", {}),
            "test_results": execution_results.get("test_results", []),
            "performance_metrics": execution_results.get("performance_metrics", {}),
            "failed_tests": self._extract_failed_tests(execution_results),
            "passed_tests": self._extract_passed_tests(execution_results),
            "trends": self._calculate_trends(execution_results),
            "recommendations": self._generate_recommendations(execution_results)
        }
        
        self.reports[report_id] = report
        return report
    
    def _calculate_duration(self, start_time: Optional[str], end_time: Optional[str]) -> float:
        """Calculate duration in seconds"""
        if not start_time or not end_time:
            return 0.0
        
        try:
            start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            return (end - start).total_seconds()
        except:
            return 0.0
    
    def _extract_failed_tests(self, execution_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract failed test cases"""
        test_results = execution_results.get("test_results", [])
        return [
            {
                "test_case_id": tr.get("test_case_id"),
                "title": tr.get("title"),
                "error": tr.get("error"),
                "expected_status": tr.get("expected_status"),
                "actual_status": tr.get("actual_status"),
                "response_time_ms": tr.get("response_time_ms")
            }
            for tr in test_results
            if tr.get("status") == "failed"
        ]
    
    def _extract_passed_tests(self, execution_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract passed test cases"""
        test_results = execution_results.get("test_results", [])
        return [
            {
                "test_case_id": tr.get("test_case_id"),
                "title": tr.get("title"),
                "response_time_ms": tr.get("response_time_ms")
            }
            for tr in test_results
            if tr.get("status") == "passed"
        ]
    
    def _calculate_trends(
        self,
        execution_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate trends and patterns"""
        test_results = execution_results.get("test_results", [])
        
        # Response time trends
        response_times = [tr.get("response_time_ms", 0) for tr in test_results if tr.get("response_time_ms")]
        
        trends = {
            "response_time_trend": {
                "avg": sum(response_times) / len(response_times) if response_times else 0,
                "min": min(response_times) if response_times else 0,
                "max": max(response_times) if response_times else 0,
                "p95": sorted(response_times)[int(len(response_times) * 0.95)] if response_times else 0
            },
            "failure_rate": len([tr for tr in test_results if tr.get("status") == "failed"]) / len(test_results) * 100 if test_results else 0,
            "slowest_endpoints": self._identify_slowest_endpoints(test_results),
            "most_failed_endpoints": self._identify_most_failed_endpoints(test_results)
        }
        
        return trends
    
    def _identify_slowest_endpoints(
        self,
        test_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Identify slowest endpoints"""
        endpoint_times = {}
        
        for tr in test_results:
            url = tr.get("url", "")
            response_time = tr.get("response_time_ms", 0)
            
            if url not in endpoint_times:
                endpoint_times[url] = []
            endpoint_times[url].append(response_time)
        
        # Calculate average per endpoint
        endpoint_avg_times = [
            {
                "endpoint": url,
                "avg_response_time_ms": sum(times) / len(times),
                "request_count": len(times)
            }
            for url, times in endpoint_times.items()
        ]
        
        # Sort by average response time (descending)
        endpoint_avg_times.sort(key=lambda x: x["avg_response_time_ms"], reverse=True)
        
        return endpoint_avg_times[:10]  # Top 10 slowest
    
    def _identify_most_failed_endpoints(
        self,
        test_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Identify endpoints with most failures"""
        endpoint_failures = {}
        
        for tr in test_results:
            url = tr.get("url", "")
            if tr.get("status") == "failed":
                endpoint_failures[url] = endpoint_failures.get(url, 0) + 1
        
        # Sort by failure count
        failed_endpoints = [
            {
                "endpoint": url,
                "failure_count": count
            }
            for url, count in endpoint_failures.items()
        ]
        failed_endpoints.sort(key=lambda x: x["failure_count"], reverse=True)
        
        return failed_endpoints[:10]  # Top 10 most failed
    
    def _generate_recommendations(
        self,
        execution_results: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on results"""
        recommendations = []
        
        summary = execution_results.get("summary", {})
        failure_rate = summary.get("pass_rate", 100)
        avg_response_time = summary.get("avg_response_time_ms", 0)
        
        if failure_rate < 80:
            recommendations.append("High failure rate detected. Review failed test cases and fix underlying issues.")
        
        if avg_response_time > 2000:
            recommendations.append("Average response time exceeds 2 seconds. Consider performance optimization.")
        
        failed_tests = self._extract_failed_tests(execution_results)
        if len(failed_tests) > 0:
            recommendations.append(f"{len(failed_tests)} test(s) failed. Review error messages for details.")
        
        trends = self._calculate_trends(execution_results)
        slowest = trends.get("slowest_endpoints", [])
        if slowest and slowest[0].get("avg_response_time_ms", 0) > 5000:
            recommendations.append(f"Endpoint {slowest[0].get('endpoint')} is very slow. Consider optimization.")
        
        return recommendations
    
    def generate_trend_report(
        self,
        execution_results_list: List[Dict[str, Any]],
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Generate trend report across multiple executions
        
        Args:
            execution_results_list: List of execution results
            days: Number of days to analyze
            
        Returns:
            Trend report
        """
        trend_report = {
            "generated_at": datetime.utcnow().isoformat(),
            "period_days": days,
            "total_executions": len(execution_results_list),
            "trends": {
                "pass_rate_trend": [],
                "response_time_trend": [],
                "test_count_trend": []
            },
            "insights": []
        }
        
        # Calculate trends over time
        for results in execution_results_list:
            summary = results.get("summary", {})
            start_time = results.get("start_time")
            
            trend_report["trends"]["pass_rate_trend"].append({
                "date": start_time,
                "pass_rate": summary.get("pass_rate", 0)
            })
            
            trend_report["trends"]["response_time_trend"].append({
                "date": start_time,
                "avg_response_time_ms": summary.get("avg_response_time_ms", 0)
            })
            
            trend_report["trends"]["test_count_trend"].append({
                "date": start_time,
                "total_tests": summary.get("total", 0)
            })
        
        # Generate insights
        if trend_report["trends"]["pass_rate_trend"]:
            recent_pass_rates = [t["pass_rate"] for t in trend_report["trends"]["pass_rate_trend"][-7:]]
            if len(recent_pass_rates) > 1:
                if recent_pass_rates[-1] < recent_pass_rates[0]:
                    trend_report["insights"].append("Pass rate is declining. Investigate recent changes.")
                else:
                    trend_report["insights"].append("Pass rate is stable or improving.")
        
        return trend_report
    
    def export_report(
        self,
        report_id: str,
        format: str = "json"
    ) -> str:
        """
        Export report in various formats
        
        Args:
            report_id: Report identifier
            format: Export format (json, html, pdf, csv)
            
        Returns:
            Exported report content
        """
        if report_id not in self.reports:
            raise ValueError(f"Report {report_id} not found")
        
        report = self.reports[report_id]
        
        if format == "json":
            return json.dumps(report, indent=2)
        elif format == "html":
            return self._generate_html_report(report)
        elif format == "csv":
            return self._generate_csv_report(report)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _generate_html_report(self, report: Dict[str, Any]) -> str:
        """Generate HTML report"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>API Test Report - {report.get('report_id')}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #333; }}
                .summary {{ background: #f5f5f5; padding: 15px; border-radius: 5px; }}
                .passed {{ color: green; }}
                .failed {{ color: red; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #4CAF50; color: white; }}
            </style>
        </head>
        <body>
            <h1>API Test Execution Report</h1>
            <div class="summary">
                <h2>Summary</h2>
                <p><strong>Execution ID:</strong> {report.get('execution_id')}</p>
                <p><strong>Generated At:</strong> {report.get('generated_at')}</p>
                <p><strong>Mode:</strong> {report.get('execution_summary', {}).get('mode')}</p>
                <p><strong>Duration:</strong> {report.get('execution_summary', {}).get('duration_seconds')} seconds</p>
                <p><strong>Total Tests:</strong> {report.get('test_summary', {}).get('total', 0)}</p>
                <p class="passed"><strong>Passed:</strong> {report.get('test_summary', {}).get('passed', 0)}</p>
                <p class="failed"><strong>Failed:</strong> {report.get('test_summary', {}).get('failed', 0)}</p>
            </div>
            
            <h2>Failed Tests</h2>
            <table>
                <tr>
                    <th>Test Case</th>
                    <th>Error</th>
                    <th>Expected Status</th>
                    <th>Actual Status</th>
                </tr>
        """
        
        for failed_test in report.get("failed_tests", []):
            html += f"""
                <tr>
                    <td>{failed_test.get('title', 'N/A')}</td>
                    <td>{failed_test.get('error', 'N/A')}</td>
                    <td>{failed_test.get('expected_status', 'N/A')}</td>
                    <td>{failed_test.get('actual_status', 'N/A')}</td>
                </tr>
            """
        
        html += """
            </table>
            
            <h2>Recommendations</h2>
            <ul>
        """
        
        for rec in report.get("recommendations", []):
            html += f"<li>{rec}</li>"
        
        html += """
            </ul>
        </body>
        </html>
        """
        
        return html
    
    def _generate_csv_report(self, report: Dict[str, Any]) -> str:
        """Generate CSV report"""
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["Test Case ID", "Title", "Status", "Response Time (ms)", "Error"])
        
        # Test results
        for test_result in report.get("test_results", []):
            writer.writerow([
                test_result.get("test_case_id", ""),
                test_result.get("title", ""),
                test_result.get("status", ""),
                test_result.get("response_time_ms", ""),
                test_result.get("error", "")
            ])
        
        return output.getvalue()


# Global instance
_reporting_engine = None

def get_reporting_engine() -> ReportingEngine:
    """Get or create global ReportingEngine instance"""
    global _reporting_engine
    if _reporting_engine is None:
        _reporting_engine = ReportingEngine()
    return _reporting_engine




