"""
Advanced Reporting Engine - PDF reports, trend analysis, comparison reports
Enterprise-grade reporting capabilities
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import json
import io

logger = logging.getLogger(__name__)


@dataclass
class TestReport:
    """Comprehensive test report"""
    test_id: str
    test_name: str
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    scenario_name: str
    virtual_users: int
    metrics: Dict[str, Any]
    system_metrics: Optional[Dict[str, Any]] = None
    errors: List[Dict[str, Any]] = field(default_factory=list)
    transactions: List[Dict[str, Any]] = field(default_factory=list)
    thresholds: Dict[str, Any] = field(default_factory=dict)
    sla_violations: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    baseline_comparison: Optional[Dict[str, Any]] = None


class ReportingEngine:
    """
    Advanced Reporting Engine
    Generates comprehensive reports with trend analysis and comparisons
    """
    
    def __init__(self):
        self.reports: Dict[str, TestReport] = {}
        self.baselines: Dict[str, Dict[str, Any]] = {}  # scenario_id -> baseline metrics
    
    def generate_report(
        self,
        test_id: str,
        test_data: Dict[str, Any],
        system_metrics: Optional[Dict[str, Any]] = None
    ) -> TestReport:
        """Generate comprehensive test report"""
        report = TestReport(
            test_id=test_id,
            test_name=test_data.get("test_name", "Performance Test"),
            start_time=datetime.fromisoformat(test_data["start_time"]) if isinstance(test_data.get("start_time"), str) else test_data.get("start_time", datetime.utcnow()),
            end_time=datetime.fromisoformat(test_data["end_time"]) if isinstance(test_data.get("end_time"), str) else test_data.get("end_time", datetime.utcnow()),
            duration_seconds=test_data.get("duration_seconds", 0),
            scenario_name=test_data.get("scenario_name", "Unknown"),
            virtual_users=test_data.get("virtual_users", 0),
            metrics=test_data.get("metrics", {}),
            system_metrics=system_metrics,
            errors=test_data.get("errors", []),
            transactions=test_data.get("transactions", []),
            thresholds=test_data.get("thresholds", {}),
            sla_violations=test_data.get("sla_violations", [])
        )
        
        # Generate recommendations
        report.recommendations = self._generate_recommendations(report)
        
        # Compare with baseline if available
        scenario_id = test_data.get("scenario_id")
        if scenario_id and scenario_id in self.baselines:
            report.baseline_comparison = self._compare_with_baseline(
                report,
                self.baselines[scenario_id]
            )
        
        self.reports[test_id] = report
        return report
    
    def _generate_recommendations(self, report: TestReport) -> List[str]:
        """Generate performance recommendations"""
        recommendations = []
        
        # Check response times
        response_times = report.metrics.get("response_time", {})
        p95 = response_times.get("p95", 0)
        p99 = response_times.get("p99", 0)
        
        if p95 > 1000:
            recommendations.append(f"P95 response time ({p95:.0f}ms) is high. Consider optimizing slow endpoints.")
        
        if p99 > 2000:
            recommendations.append(f"P99 response time ({p99:.0f}ms) is very high. Investigate outliers.")
        
        # Check error rate
        error_rate = report.metrics.get("iterations", {}).get("error_rate", 0)
        if error_rate > 0.01:
            recommendations.append(f"Error rate ({error_rate*100:.2f}%) is high. Review error logs for root causes.")
        
        # Check throughput
        throughput = report.metrics.get("throughput", {}).get("rps", 0)
        if throughput < 10:
            recommendations.append(f"Throughput ({throughput:.1f} RPS) is low. Consider increasing concurrency or optimizing requests.")
        
        # Check system resources
        if report.system_metrics:
            cpu_avg = report.system_metrics.get("cpu", {}).get("avg_percent", 0)
            if cpu_avg > 80:
                recommendations.append(f"Average CPU usage ({cpu_avg:.1f}%) is high. Consider scaling horizontally.")
            
            memory_avg = report.system_metrics.get("memory", {}).get("avg_percent", 0)
            if memory_avg > 85:
                recommendations.append(f"Average memory usage ({memory_avg:.1f}%) is high. Check for memory leaks.")
        
        # Check SLA violations
        if report.sla_violations:
            recommendations.append(f"{len(report.sla_violations)} SLA violations detected. Review SLA thresholds.")
        
        return recommendations
    
    def _compare_with_baseline(
        self,
        report: TestReport,
        baseline: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compare test results with baseline"""
        comparison = {
            "baseline_test_id": baseline.get("test_id"),
            "baseline_date": baseline.get("start_time"),
            "differences": {}
        }
        
        # Compare response times
        current_rt = report.metrics.get("response_time", {})
        baseline_rt = baseline.get("metrics", {}).get("response_time", {})
        
        if current_rt and baseline_rt:
            for percentile in ["avg", "p95", "p99"]:
                current_val = current_rt.get(percentile, 0)
                baseline_val = baseline_rt.get(percentile, 0)
                
                if baseline_val > 0:
                    change_pct = ((current_val - baseline_val) / baseline_val) * 100
                    comparison["differences"][f"response_time_{percentile}"] = {
                        "current": current_val,
                        "baseline": baseline_val,
                        "change_percent": change_pct,
                        "regression": change_pct > 10  # >10% increase is regression
                    }
        
        # Compare error rate
        current_err = report.metrics.get("iterations", {}).get("error_rate", 0)
        baseline_err = baseline.get("metrics", {}).get("iterations", {}).get("error_rate", 0)
        
        if baseline_err >= 0:
            change_pct = ((current_err - baseline_err) / (baseline_err + 0.001)) * 100
            comparison["differences"]["error_rate"] = {
                "current": current_err,
                "baseline": baseline_err,
                "change_percent": change_pct,
                "regression": current_err > baseline_err * 1.1
            }
        
        # Compare throughput
        current_tp = report.metrics.get("throughput", {}).get("rps", 0)
        baseline_tp = baseline.get("metrics", {}).get("throughput", {}).get("rps", 0)
        
        if baseline_tp > 0:
            change_pct = ((current_tp - baseline_tp) / baseline_tp) * 100
            comparison["differences"]["throughput"] = {
                "current": current_tp,
                "baseline": baseline_tp,
                "change_percent": change_pct,
                "regression": change_pct < -10  # >10% decrease is regression
            }
        
        # Overall regression status
        regressions = [
            diff.get("regression", False)
            for diff in comparison["differences"].values()
        ]
        comparison["has_regression"] = any(regressions)
        comparison["regression_count"] = sum(regressions)
        
        return comparison
    
    def set_baseline(
        self,
        scenario_id: str,
        test_id: str,
        test_data: Dict[str, Any]
    ):
        """Set a test run as baseline for comparison"""
        self.baselines[scenario_id] = {
            "test_id": test_id,
            "start_time": test_data.get("start_time"),
            "metrics": test_data.get("metrics", {})
        }
        logger.info(f"Set baseline for scenario {scenario_id}: test {test_id}")
    
    def get_report(self, test_id: str) -> Optional[TestReport]:
        """Get report by test ID"""
        return self.reports.get(test_id)
    
    def export_report_json(self, test_id: str) -> str:
        """Export report as JSON"""
        report = self.get_report(test_id)
        if not report:
            raise ValueError(f"Report not found: {test_id}")
        
        report_dict = {
            "test_id": report.test_id,
            "test_name": report.test_name,
            "start_time": report.start_time.isoformat(),
            "end_time": report.end_time.isoformat(),
            "duration_seconds": report.duration_seconds,
            "scenario_name": report.scenario_name,
            "virtual_users": report.virtual_users,
            "metrics": report.metrics,
            "system_metrics": report.system_metrics,
            "errors": report.errors,
            "transactions": report.transactions,
            "thresholds": report.thresholds,
            "sla_violations": report.sla_violations,
            "recommendations": report.recommendations,
            "baseline_comparison": report.baseline_comparison
        }
        
        return json.dumps(report_dict, indent=2)
    
    def generate_trend_analysis(
        self,
        scenario_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Generate trend analysis for a scenario over time"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Filter reports for this scenario
        scenario_reports = [
            r for r in self.reports.values()
            if r.scenario_name == scenario_id or r.test_id.startswith(scenario_id)
        ]
        
        # Filter by date range
        scenario_reports = [
            r for r in scenario_reports
            if start_date <= r.start_time <= end_date
        ]
        
        if not scenario_reports:
            return {"error": "No reports found for trend analysis"}
        
        # Sort by date
        scenario_reports.sort(key=lambda x: x.start_time)
        
        # Extract trends
        dates = [r.start_time.isoformat() for r in scenario_reports]
        p95_values = [r.metrics.get("response_time", {}).get("p95", 0) for r in scenario_reports]
        error_rates = [r.metrics.get("iterations", {}).get("error_rate", 0) for r in scenario_reports]
        throughput_values = [r.metrics.get("throughput", {}).get("rps", 0) for r in scenario_reports]
        
        return {
            "scenario_id": scenario_id,
            "time_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days": days
            },
            "report_count": len(scenario_reports),
            "trends": {
                "dates": dates,
                "response_time_p95": p95_values,
                "error_rate": error_rates,
                "throughput_rps": throughput_values
            },
            "summary": {
                "avg_p95": sum(p95_values) / len(p95_values) if p95_values else 0,
                "max_p95": max(p95_values) if p95_values else 0,
                "min_p95": min(p95_values) if p95_values else 0,
                "avg_error_rate": sum(error_rates) / len(error_rates) if error_rates else 0,
                "avg_throughput": sum(throughput_values) / len(throughput_values) if throughput_values else 0
            }
        }
    
    def generate_comparison_report(
        self,
        test_ids: List[str]
    ) -> Dict[str, Any]:
        """Generate comparison report for multiple test runs"""
        reports = [self.get_report(tid) for tid in test_ids]
        reports = [r for r in reports if r is not None]
        
        if len(reports) < 2:
            return {"error": "At least 2 test reports required for comparison"}
        
        comparison = {
            "test_ids": test_ids,
            "test_names": [r.test_name for r in reports],
            "comparison": {}
        }
        
        # Compare metrics
        metrics_to_compare = [
            ("response_time.avg", "Response Time (Avg)"),
            ("response_time.p95", "Response Time (P95)"),
            ("response_time.p99", "Response Time (P99)"),
            ("iterations.error_rate", "Error Rate"),
            ("throughput.rps", "Throughput (RPS)")
        ]
        
        for metric_path, metric_name in metrics_to_compare:
            values = []
            for report in reports:
                parts = metric_path.split(".")
                value = report.metrics
                for part in parts:
                    value = value.get(part, {}) if isinstance(value, dict) else 0
                values.append(value if isinstance(value, (int, float)) else 0)
            
            comparison["comparison"][metric_name] = {
                "values": values,
                "min": min(values) if values else 0,
                "max": max(values) if values else 0,
                "avg": sum(values) / len(values) if values else 0
            }
        
        return comparison




