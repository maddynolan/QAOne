"""
Flaky Test Detection Engine
Analyzes test execution history to identify flaky tests and predict failures.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import math

from app.services.storage.postgres_direct import execute_query, get_postgres_pool

logger = logging.getLogger(__name__)


class FlakyDetector:
    """
    Detects flaky tests by analyzing execution history patterns.
    
    Flaky indicators:
    - Pass/fail alternating pattern (flip-flop)
    - Same test different results in quick succession
    - Timing-related failures (tests that fail only during peak hours)
    - Infrastructure-related failures (browser/OS specific)
    - High variance in execution time
    """
    
    def __init__(self):
        self.min_executions = 5  # Minimum executions for statistical significance
        self.flakiness_threshold = 0.2  # 20% - above this is considered flaky
        self.flip_weight = 0.4  # Weight for flip-flop detection
        self.variance_weight = 0.3  # Weight for execution time variance
        self.pattern_weight = 0.3  # Weight for failure pattern analysis
    
    async def analyze_test_history(
        self,
        test_id: str,
        window_days: int = 30
    ) -> Dict[str, Any]:
        """
        Analyze test execution history to detect flakiness.
        
        Args:
            test_id: The test case ID to analyze
            window_days: Number of days of history to analyze
            
        Returns:
            Analysis result with flakiness score and recommendations
        """
        try:
            pool = get_postgres_pool()
            if not pool:
                return self._default_result(test_id)
            
            start_date = datetime.utcnow() - timedelta(days=window_days)
            
            # Get test execution history
            query = """
                SELECT 
                    tr.run_id, tr.status, tr.duration, tr.created_at,
                    tr.browser, tr.environment,
                    EXTRACT(HOUR FROM tr.created_at) as hour,
                    EXTRACT(DOW FROM tr.created_at) as day_of_week
                FROM test_runs tr
                JOIN test_run_results trr ON tr.run_id = trr.run_id
                WHERE trr.test_case_id = $1
                AND tr.created_at >= $2
                ORDER BY tr.created_at ASC
            """
            
            results = await execute_query(query, (test_id, start_date))
            
            if not results or len(results) < self.min_executions:
                return self._insufficient_data_result(test_id, len(results) if results else 0)
            
            # Calculate flakiness metrics
            flip_score = self._calculate_flip_score(results)
            variance_score = self._calculate_variance_score(results)
            pattern_score = self._calculate_pattern_score(results)
            
            # Weighted flakiness score
            flakiness_score = (
                flip_score * self.flip_weight +
                variance_score * self.variance_weight +
                pattern_score * self.pattern_weight
            )
            
            # Determine likely cause
            likely_cause = self._identify_likely_cause(results, flip_score, variance_score, pattern_score)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(
                flakiness_score, likely_cause, results
            )
            
            return {
                "test_id": test_id,
                "is_flaky": flakiness_score >= self.flakiness_threshold,
                "flakiness_score": round(flakiness_score, 3),
                "executions_analyzed": len(results),
                "window_days": window_days,
                "metrics": {
                    "flip_score": round(flip_score, 3),
                    "variance_score": round(variance_score, 3),
                    "pattern_score": round(pattern_score, 3)
                },
                "statistics": self._calculate_statistics(results),
                "likely_cause": likely_cause,
                "recommendations": recommendations,
                "analyzed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing test history: {e}", exc_info=True)
            return self._error_result(test_id, str(e))
    
    def _calculate_flip_score(self, results: List[Dict]) -> float:
        """
        Calculate flip-flop score - how often the test alternates between pass/fail.
        Higher score = more flaky
        """
        if len(results) < 2:
            return 0.0
        
        flips = 0
        prev_status = results[0].get("status")
        
        for result in results[1:]:
            curr_status = result.get("status")
            # Check if status flipped between pass and fail
            if (prev_status == "passed" and curr_status == "failed") or \
               (prev_status == "failed" and curr_status == "passed"):
                flips += 1
            prev_status = curr_status
        
        # Normalize: max flips would be len-1
        max_flips = len(results) - 1
        return flips / max_flips if max_flips > 0 else 0.0
    
    def _calculate_variance_score(self, results: List[Dict]) -> float:
        """
        Calculate execution time variance score.
        High variance can indicate environmental instability.
        """
        durations = [r.get("duration", 0) for r in results if r.get("duration")]
        
        if len(durations) < 2:
            return 0.0
        
        mean = sum(durations) / len(durations)
        if mean == 0:
            return 0.0
        
        # Calculate coefficient of variation (CV = std_dev / mean)
        variance = sum((d - mean) ** 2 for d in durations) / len(durations)
        std_dev = math.sqrt(variance)
        cv = std_dev / mean
        
        # Normalize to 0-1 range (CV > 0.5 is very high)
        return min(cv / 0.5, 1.0)
    
    def _calculate_pattern_score(self, results: List[Dict]) -> float:
        """
        Analyze failure patterns - time-based, browser-based, etc.
        Returns score based on pattern consistency.
        """
        if not results:
            return 0.0
        
        failed_results = [r for r in results if r.get("status") == "failed"]
        if not failed_results:
            return 0.0
        
        # Check for time-based patterns
        failure_hours = [r.get("hour", 0) for r in failed_results]
        hour_concentration = self._calculate_concentration(failure_hours, 24)
        
        # Check for browser-based patterns
        failure_browsers = [r.get("browser", "unknown") for r in failed_results]
        all_browsers = [r.get("browser", "unknown") for r in results]
        browser_score = self._calculate_browser_pattern(failure_browsers, all_browsers)
        
        # If failures are highly concentrated (time or browser), it's more predictable
        # and less "flaky" - so we invert the concentration score
        pattern_score = 1.0 - max(hour_concentration, browser_score) * 0.5
        
        return max(0.0, pattern_score)
    
    def _calculate_concentration(self, values: List[Any], max_range: int) -> float:
        """Calculate how concentrated values are (0 = spread out, 1 = concentrated)"""
        if not values:
            return 0.0
        
        counter = defaultdict(int)
        for v in values:
            counter[v] += 1
        
        # If all values are in one bucket, concentration is high
        max_count = max(counter.values())
        return max_count / len(values)
    
    def _calculate_browser_pattern(
        self, 
        failure_browsers: List[str], 
        all_browsers: List[str]
    ) -> float:
        """Check if failures are concentrated in specific browsers"""
        if not failure_browsers or not all_browsers:
            return 0.0
        
        browser_failures = defaultdict(int)
        browser_totals = defaultdict(int)
        
        for b in failure_browsers:
            browser_failures[b] += 1
        for b in all_browsers:
            browser_totals[b] += 1
        
        # Calculate failure rate per browser
        failure_rates = {}
        for browser, total in browser_totals.items():
            failures = browser_failures.get(browser, 0)
            failure_rates[browser] = failures / total if total > 0 else 0
        
        if not failure_rates:
            return 0.0
        
        # If failure rates vary significantly, it's a browser-specific issue
        rates = list(failure_rates.values())
        if len(rates) < 2:
            return 0.0
        
        max_rate = max(rates)
        min_rate = min(rates)
        
        return max_rate - min_rate
    
    def _identify_likely_cause(
        self,
        results: List[Dict],
        flip_score: float,
        variance_score: float,
        pattern_score: float
    ) -> str:
        """Identify the most likely cause of flakiness"""
        
        # Get failure messages for analysis
        failed_results = [r for r in results if r.get("status") == "failed"]
        
        if not failed_results:
            return "no_failures"
        
        # High flip score indicates random/intermittent failures
        if flip_score > 0.4:
            return "intermittent_failure"
        
        # High variance indicates timing/performance issues
        if variance_score > 0.5:
            return "timing_issues"
        
        # Low pattern score with failures indicates environmental issues
        if pattern_score < 0.3:
            return "environmental_factors"
        
        # Check for browser-specific issues
        browsers = defaultdict(int)
        for r in failed_results:
            browsers[r.get("browser", "unknown")] += 1
        
        if len(browsers) == 1:
            return f"browser_specific_{list(browsers.keys())[0]}"
        
        # Check for time-based issues
        hours = [r.get("hour", 0) for r in failed_results]
        if hours:
            avg_hour = sum(hours) / len(hours)
            if 8 <= avg_hour <= 18:
                return "peak_hours_failure"
        
        return "undetermined"
    
    def _generate_recommendations(
        self,
        flakiness_score: float,
        likely_cause: str,
        results: List[Dict]
    ) -> List[str]:
        """Generate actionable recommendations based on analysis"""
        recommendations = []
        
        if flakiness_score < self.flakiness_threshold:
            recommendations.append("Test appears stable. No immediate action needed.")
            return recommendations
        
        # General recommendations for flaky tests
        recommendations.append("Consider adding retry logic for this test")
        
        # Cause-specific recommendations
        if likely_cause == "intermittent_failure":
            recommendations.extend([
                "Check for race conditions in the test",
                "Add explicit waits instead of implicit waits",
                "Verify test data isolation",
                "Check for async operations completing before assertions"
            ])
        elif likely_cause == "timing_issues":
            recommendations.extend([
                "Increase timeout values",
                "Add waitForSelector/waitForLoadState calls",
                "Check for slow network requests",
                "Consider running tests with throttled network"
            ])
        elif likely_cause == "environmental_factors":
            recommendations.extend([
                "Ensure consistent test environment",
                "Check CI/CD resource allocation",
                "Verify database/service dependencies are stable"
            ])
        elif likely_cause.startswith("browser_specific"):
            browser = likely_cause.replace("browser_specific_", "")
            recommendations.extend([
                f"Investigate {browser}-specific behavior",
                f"Check for {browser} CSS/JS compatibility issues",
                "Consider browser-specific selectors"
            ])
        elif likely_cause == "peak_hours_failure":
            recommendations.extend([
                "Schedule tests during off-peak hours",
                "Check for shared resource contention",
                "Verify system capacity during peak times"
            ])
        
        # High flakiness additional recommendations
        if flakiness_score > 0.5:
            recommendations.append("Consider quarantining this test until fixed")
            recommendations.append("Review test design for anti-patterns")
        
        return recommendations
    
    def _calculate_statistics(self, results: List[Dict]) -> Dict[str, Any]:
        """Calculate summary statistics from results"""
        total = len(results)
        passed = sum(1 for r in results if r.get("status") == "passed")
        failed = sum(1 for r in results if r.get("status") == "failed")
        
        durations = [r.get("duration", 0) for r in results if r.get("duration")]
        
        return {
            "total_executions": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": round(passed / total * 100, 1) if total > 0 else 0,
            "avg_duration_ms": round(sum(durations) / len(durations)) if durations else 0,
            "min_duration_ms": min(durations) if durations else 0,
            "max_duration_ms": max(durations) if durations else 0,
            "last_execution": results[-1].get("created_at").isoformat() if results else None,
            "last_status": results[-1].get("status") if results else None
        }
    
    def _default_result(self, test_id: str) -> Dict[str, Any]:
        """Return default result when database is unavailable"""
        return {
            "test_id": test_id,
            "is_flaky": False,
            "flakiness_score": 0.0,
            "executions_analyzed": 0,
            "error": "Database unavailable",
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    def _insufficient_data_result(self, test_id: str, count: int) -> Dict[str, Any]:
        """Return result when there's insufficient data for analysis"""
        return {
            "test_id": test_id,
            "is_flaky": False,
            "flakiness_score": 0.0,
            "executions_analyzed": count,
            "message": f"Insufficient data for analysis. Minimum {self.min_executions} executions required.",
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    def _error_result(self, test_id: str, error: str) -> Dict[str, Any]:
        """Return result when an error occurs during analysis"""
        return {
            "test_id": test_id,
            "is_flaky": False,
            "flakiness_score": 0.0,
            "error": error,
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    async def get_flaky_tests(
        self,
        project_id: str,
        window_days: int = 30,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get all flaky tests for a project, sorted by flakiness score.
        
        Args:
            project_id: Project to analyze
            window_days: Analysis window
            limit: Maximum number of tests to return
            
        Returns:
            List of flaky tests with their scores
        """
        try:
            pool = get_postgres_pool()
            if not pool:
                return []
            
            start_date = datetime.utcnow() - timedelta(days=window_days)
            
            # Get tests with both passes and failures (potential flaky candidates)
            query = """
                SELECT 
                    tc.test_case_id,
                    tc.title as test_name,
                    COUNT(*) as total_runs,
                    SUM(CASE WHEN tr.status = 'passed' THEN 1 ELSE 0 END) as passes,
                    SUM(CASE WHEN tr.status = 'failed' THEN 1 ELSE 0 END) as failures,
                    MAX(tr.created_at) as last_run
                FROM test_cases tc
                JOIN test_run_results trr ON tc.test_case_id = trr.test_case_id
                JOIN test_runs tr ON trr.run_id = tr.run_id
                WHERE tc.project_id = $1
                AND tr.created_at >= $2
                GROUP BY tc.test_case_id, tc.title
                HAVING SUM(CASE WHEN tr.status = 'passed' THEN 1 ELSE 0 END) > 0
                AND SUM(CASE WHEN tr.status = 'failed' THEN 1 ELSE 0 END) > 0
                ORDER BY 
                    (SUM(CASE WHEN tr.status = 'failed' THEN 1 ELSE 0 END)::float / COUNT(*)) DESC
                LIMIT $3
            """
            
            results = await execute_query(query, (project_id, start_date, limit))
            
            if not results:
                return []
            
            flaky_tests = []
            for row in results:
                # Quick flakiness calculation
                total = row.get("total_runs", 0)
                failures = row.get("failures", 0)
                passes = row.get("passes", 0)
                
                if total < self.min_executions:
                    continue
                
                # Simple flip estimation based on pass/fail ratio
                failure_rate = failures / total if total > 0 else 0
                flip_estimate = min(failure_rate * (1 - failure_rate) * 4, 1.0)  # Parabola peaks at 0.5
                
                flaky_tests.append({
                    "test_id": str(row.get("test_case_id")),
                    "test_name": row.get("test_name", "Unknown"),
                    "flakiness_score": round(flip_estimate, 3),
                    "total_runs": total,
                    "passes": passes,
                    "failures": failures,
                    "failure_rate": round(failure_rate * 100, 1),
                    "last_run": row.get("last_run").isoformat() if row.get("last_run") else None
                })
            
            # Sort by flakiness score
            flaky_tests.sort(key=lambda x: x["flakiness_score"], reverse=True)
            
            return flaky_tests
            
        except Exception as e:
            logger.error(f"Error getting flaky tests: {e}", exc_info=True)
            return []


# Singleton instance
_flaky_detector: Optional[FlakyDetector] = None


def get_flaky_detector() -> FlakyDetector:
    """Get singleton instance of FlakyDetector"""
    global _flaky_detector
    if _flaky_detector is None:
        _flaky_detector = FlakyDetector()
    return _flaky_detector

