"""
Q-Index Service - Unified Quality Score
Calculates Q-Index based on requirement coverage, mutation score, flake rate,
performance/accessibility/security compliance, and critical defect trends.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@dataclass
class QIndexMetrics:
    """Breakdown of Q-Index components"""
    req_coverage: float  # 0-1
    mutation_score: float  # 0-1
    flake_rate: float  # 0-1 (lower is better, so inverted)
    perf_compliance: float  # 0-1
    accessibility_compliance: float  # 0-1
    security_compliance: float  # 0-1
    critical_defect_trend: float  # 0-1 (lower is better, so inverted)
    overall_score: float  # 0-1


@dataclass
class QualityGate:
    """Quality gate thresholds"""
    q_index_min: float = 0.7
    req_coverage_min: float = 0.8
    mutation_score_min: float = 0.6
    flake_rate_max: float = 0.1
    perf_threshold: float = 0.9
    accessibility_threshold: float = 0.95
    security_threshold: float = 1.0  # No security failures allowed
    critical_defects_max: int = 0


class QIndexService:
    """
    Service for calculating Q-Index (Unified Quality Score).
    Combines multiple quality metrics into a single score.
    """

    def __init__(self):
        # Default weights for Q-Index components
        self.weights = {
            "req_coverage": 0.20,
            "mutation_score": 0.15,
            "flake_rate": 0.15,
            "perf_compliance": 0.15,
            "accessibility_compliance": 0.10,
            "security_compliance": 0.15,
            "critical_defect_trend": 0.10
        }

    def calculate_q_index(
        self,
        project_id: str,
        metrics_data: Optional[Dict[str, Any]] = None
    ) -> QIndexMetrics:
        """
        Calculate Q-Index for a project.
        
        Args:
            project_id: Project identifier
            metrics_data: Optional pre-calculated metrics
            
        Returns:
            QIndexMetrics with all components
        """
        # Get or calculate individual metrics
        req_coverage = self._calculate_req_coverage(project_id, metrics_data)
        mutation_score = self._calculate_mutation_score(project_id, metrics_data)
        flake_rate = self._calculate_flake_rate(project_id, metrics_data)
        perf_compliance = self._calculate_perf_compliance(project_id, metrics_data)
        accessibility_compliance = self._calculate_accessibility_compliance(project_id, metrics_data)
        security_compliance = self._calculate_security_compliance(project_id, metrics_data)
        critical_defect_trend = self._calculate_critical_defect_trend(project_id, metrics_data)

        # Calculate weighted overall score
        overall_score = (
            self.weights["req_coverage"] * req_coverage +
            self.weights["mutation_score"] * mutation_score +
            self.weights["flake_rate"] * (1.0 - flake_rate) +  # Invert flake rate (lower is better)
            self.weights["perf_compliance"] * perf_compliance +
            self.weights["accessibility_compliance"] * accessibility_compliance +
            self.weights["security_compliance"] * security_compliance +
            self.weights["critical_defect_trend"] * (1.0 - critical_defect_trend)  # Invert (lower is better)
        )

        return QIndexMetrics(
            req_coverage=req_coverage,
            mutation_score=mutation_score,
            flake_rate=flake_rate,
            perf_compliance=perf_compliance,
            accessibility_compliance=accessibility_compliance,
            security_compliance=security_compliance,
            critical_defect_trend=critical_defect_trend,
            overall_score=overall_score
        )

    def check_quality_gates(
        self,
        metrics: QIndexMetrics,
        gates: Optional[QualityGate] = None
    ) -> Dict[str, Any]:
        """
        Check if quality gates are met.
        
        Returns:
            Dict with gate status and violations
        """
        gates = gates or QualityGate()
        violations = []
        passed = True

        if metrics.overall_score < gates.q_index_min:
            violations.append(f"Q-Index {metrics.overall_score:.2%} below minimum {gates.q_index_min:.2%}")
            passed = False

        if metrics.req_coverage < gates.req_coverage_min:
            violations.append(f"Requirement coverage {metrics.req_coverage:.2%} below minimum {gates.req_coverage_min:.2%}")
            passed = False

        if metrics.mutation_score < gates.mutation_score_min:
            violations.append(f"Mutation score {metrics.mutation_score:.2%} below minimum {gates.mutation_score_min:.2%}")
            passed = False

        if metrics.flake_rate > gates.flake_rate_max:
            violations.append(f"Flake rate {metrics.flake_rate:.2%} above maximum {gates.flake_rate_max:.2%}")
            passed = False

        if metrics.perf_compliance < gates.perf_threshold:
            violations.append(f"Performance compliance {metrics.perf_compliance:.2%} below threshold {gates.perf_threshold:.2%}")
            passed = False

        if metrics.accessibility_compliance < gates.accessibility_threshold:
            violations.append(f"Accessibility compliance {metrics.accessibility_compliance:.2%} below threshold {gates.accessibility_threshold:.2%}")
            passed = False

        if metrics.security_compliance < gates.security_threshold:
            violations.append(f"Security compliance {metrics.security_compliance:.2%} below threshold {gates.security_threshold:.2%}")
            passed = False  # Security is critical

        return {
            "passed": passed,
            "violations": violations,
            "metrics": metrics,
            "gates": gates
        }

    def _calculate_req_coverage(self, project_id: str, metrics_data: Optional[Dict[str, Any]]) -> float:
        """Calculate requirement coverage (0-1)"""
        if metrics_data and "req_coverage" in metrics_data:
            return float(metrics_data["req_coverage"])

        # TODO: Query database for actual coverage
        # For now, return placeholder
        return 0.75

    def _calculate_mutation_score(self, project_id: str, metrics_data: Optional[Dict[str, Any]]) -> float:
        """Calculate mutation testing score (0-1)"""
        if metrics_data and "mutation_score" in metrics_data:
            return float(metrics_data["mutation_score"])

        # TODO: Query mutation testing results
        return 0.65

    def _calculate_flake_rate(self, project_id: str, metrics_data: Optional[Dict[str, Any]]) -> float:
        """Calculate flake rate (0-1, lower is better)"""
        if metrics_data and "flake_rate" in metrics_data:
            return float(metrics_data["flake_rate"])

        # TODO: Query test runs for flaky tests
        # Flake rate = (tests that pass sometimes and fail sometimes) / total tests
        return 0.05  # 5% flake rate

    def _calculate_perf_compliance(self, project_id: str, metrics_data: Optional[Dict[str, Any]]) -> float:
        """Calculate performance compliance (0-1)"""
        if metrics_data and "perf_compliance" in metrics_data:
            return float(metrics_data["perf_compliance"])

        # TODO: Query performance test results
        # Compliance = tests meeting performance thresholds / total performance tests
        return 0.90

    def _calculate_accessibility_compliance(self, project_id: str, metrics_data: Optional[Dict[str, Any]]) -> float:
        """Calculate accessibility compliance (0-1)"""
        if metrics_data and "accessibility_compliance" in metrics_data:
            return float(metrics_data["accessibility_compliance"])

        # TODO: Query accessibility test results
        # Compliance = tests passing WCAG checks / total accessibility tests
        return 0.95

    def _calculate_security_compliance(self, project_id: str, metrics_data: Optional[Dict[str, Any]]) -> float:
        """Calculate security compliance (0-1)"""
        if metrics_data and "security_compliance" in metrics_data:
            return float(metrics_data["security_compliance"])

        # TODO: Query security test results
        # Compliance = tests with no security issues / total security tests
        return 1.0  # Assume 100% if no security tests

    def _calculate_critical_defect_trend(self, project_id: str, metrics_data: Optional[Dict[str, Any]]) -> float:
        """Calculate critical defect trend (0-1, lower is better)"""
        if metrics_data and "critical_defect_trend" in metrics_data:
            return float(metrics_data["critical_defect_trend"])

        # TODO: Query defects for trend analysis
        # Trend = rate of change in critical defects (increasing = bad)
        return 0.02  # 2% trend (low is good)


# Global instance
q_index_service = QIndexService()




