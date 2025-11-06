"""
Risk-based Planner Service
Prioritizes tests based on code churn, dependency centrality, production usage, and past defect density.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@dataclass
class RiskFactor:
    """A risk factor contributing to test priority"""
    name: str
    weight: float
    value: float
    explanation: str


@dataclass
class TestPriority:
    """Calculated priority for a test case"""
    test_id: str
    risk_score: float
    factors: List[RiskFactor]
    priority_level: str  # 'critical', 'high', 'medium', 'low'
    recommended_order: int


class RiskBasedPlanner:
    """
    Risk-based test planner.
    Combines multiple factors to prioritize test execution.
    """

    def __init__(self):
        # Default weights for risk factors
        self.weights = {
            "code_churn": 0.25,
            "dependency_centrality": 0.20,
            "prod_usage": 0.25,
            "defect_density": 0.20,
            "business_criticality": 0.10
        }

    def calculate_priority(
        self,
        test_case: Dict[str, Any],
        code_churn_data: Optional[Dict[str, Any]] = None,
        dependency_data: Optional[Dict[str, Any]] = None,
        prod_usage_data: Optional[Dict[str, Any]] = None,
        defect_history: Optional[List[Dict[str, Any]]] = None,
        business_criticality: Optional[str] = None
    ) -> TestPriority:
        """
        Calculate risk-based priority for a test case.
        
        Args:
            test_case: Test case information
            code_churn_data: Recent code changes for related modules
            dependency_data: Dependency graph information
            prod_usage_data: Production usage metrics
            defect_history: Historical defect data
            business_criticality: Business criticality level
            
        Returns:
            TestPriority with calculated risk score
        """
        factors = []

        # Code churn factor
        churn_score = self._calculate_code_churn_score(code_churn_data or {})
        factors.append(RiskFactor(
            name="code_churn",
            weight=self.weights["code_churn"],
            value=churn_score,
            explanation=self._explain_code_churn(code_churn_data)
        ))

        # Dependency centrality factor
        centrality_score = self._calculate_centrality_score(dependency_data or {})
        factors.append(RiskFactor(
            name="dependency_centrality",
            weight=self.weights["dependency_centrality"],
            value=centrality_score,
            explanation=self._explain_centrality(dependency_data)
        ))

        # Production usage factor
        usage_score = self._calculate_usage_score(prod_usage_data or {})
        factors.append(RiskFactor(
            name="prod_usage",
            weight=self.weights["prod_usage"],
            value=usage_score,
            explanation=self._explain_usage(prod_usage_data)
        ))

        # Defect density factor
        defect_score = self._calculate_defect_density_score(defect_history or [])
        factors.append(RiskFactor(
            name="defect_density",
            weight=self.weights["defect_density"],
            value=defect_score,
            explanation=self._explain_defect_density(defect_history)
        ))

        # Business criticality factor
        criticality_score = self._calculate_business_criticality(business_criticality)
        factors.append(RiskFactor(
            name="business_criticality",
            weight=self.weights["business_criticality"],
            value=criticality_score,
            explanation=f"Business criticality: {business_criticality or 'medium'}"
        ))

        # Calculate weighted risk score
        risk_score = sum(factor.weight * factor.value for factor in factors)
        risk_score = min(1.0, max(0.0, risk_score))  # Clamp to [0, 1]

        # Determine priority level
        if risk_score >= 0.8:
            priority_level = "critical"
        elif risk_score >= 0.6:
            priority_level = "high"
        elif risk_score >= 0.4:
            priority_level = "medium"
        else:
            priority_level = "low"

        return TestPriority(
            test_id=test_case.get("id") or test_case.get("case_id", "unknown"),
            risk_score=risk_score,
            factors=factors,
            priority_level=priority_level,
            recommended_order=0  # Will be set by ordering algorithm
        )

    def plan_test_suite(
        self,
        test_cases: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]] = None
    ) -> List[TestPriority]:
        """
        Plan and prioritize a full test suite.
        
        Returns:
            List of TestPriority objects, sorted by risk score (highest first)
        """
        priorities = []

        for test_case in test_cases:
            # Extract context for this test case
            test_context = context or {}
            
            priority = self.calculate_priority(
                test_case=test_case,
                code_churn_data=test_context.get("code_churn"),
                dependency_data=test_context.get("dependencies"),
                prod_usage_data=test_context.get("prod_usage"),
                defect_history=test_context.get("defect_history"),
                business_criticality=test_case.get("business_criticality")
            )
            priorities.append(priority)

        # Sort by risk score (highest first)
        priorities.sort(key=lambda p: p.risk_score, reverse=True)

        # Set recommended order
        for i, priority in enumerate(priorities):
            priority.recommended_order = i + 1

        return priorities

    def _calculate_code_churn_score(self, churn_data: Dict[str, Any]) -> float:
        """Calculate score based on code churn (0-1)"""
        if not churn_data:
            return 0.3  # Default moderate risk

        recent_changes = churn_data.get("recent_changes", 0)
        change_rate = churn_data.get("change_rate", 0)
        affected_files = churn_data.get("affected_files", 0)

        # Normalize to 0-1 scale
        # High churn = higher risk
        score = min(1.0, (recent_changes * 0.1 + change_rate * 0.5 + affected_files * 0.05))
        return score

    def _calculate_centrality_score(self, dependency_data: Dict[str, Any]) -> float:
        """Calculate score based on dependency centrality (0-1)"""
        if not dependency_data:
            return 0.3

        inbound_deps = dependency_data.get("inbound_dependencies", 0)
        outbound_deps = dependency_data.get("outbound_dependencies", 0)
        centrality_index = dependency_data.get("centrality_index", 0)

        # More dependencies = higher centrality = higher risk
        score = min(1.0, (inbound_deps * 0.02 + outbound_deps * 0.02 + centrality_index * 0.5))
        return score

    def _calculate_usage_score(self, usage_data: Dict[str, Any]) -> float:
        """Calculate score based on production usage (0-1)"""
        if not usage_data:
            return 0.3

        request_count = usage_data.get("request_count", 0)
        user_count = usage_data.get("user_count", 0)
        error_rate = usage_data.get("error_rate", 0)

        # Higher usage = higher risk
        usage_component = min(1.0, (request_count / 1000000) + (user_count / 10000))
        error_component = min(1.0, error_rate * 10)  # 10% error rate = max score
        
        score = (usage_component * 0.7 + error_component * 0.3)
        return min(1.0, score)

    def _calculate_defect_density_score(self, defect_history: List[Dict[str, Any]]) -> float:
        """Calculate score based on past defect density (0-1)"""
        if not defect_history:
            return 0.2  # Low risk if no history

        # Count defects in last 90 days
        cutoff_date = datetime.utcnow() - timedelta(days=90)
        recent_defects = [
            d for d in defect_history
            if datetime.fromisoformat(d.get("created_at", "")) > cutoff_date
        ]

        defect_count = len(recent_defects)
        critical_defects = sum(1 for d in recent_defects if d.get("severity") == "critical")

        # Higher defect count = higher risk
        score = min(1.0, (defect_count * 0.1 + critical_defects * 0.3))
        return score

    def _calculate_business_criticality(self, criticality: Optional[str]) -> float:
        """Calculate score based on business criticality (0-1)"""
        mapping = {
            "critical": 1.0,
            "high": 0.7,
            "medium": 0.4,
            "low": 0.1,
            None: 0.3
        }
        return mapping.get(criticality, 0.3)

    def _explain_code_churn(self, churn_data: Dict[str, Any]) -> str:
        """Generate explanation for code churn factor"""
        if not churn_data:
            return "No recent code churn data available"
        changes = churn_data.get("recent_changes", 0)
        files = churn_data.get("affected_files", 0)
        return f"{changes} recent changes across {files} files"

    def _explain_centrality(self, dependency_data: Dict[str, Any]) -> str:
        """Generate explanation for dependency centrality"""
        if not dependency_data:
            return "No dependency data available"
        inbound = dependency_data.get("inbound_dependencies", 0)
        outbound = dependency_data.get("outbound_dependencies", 0)
        return f"{inbound} inbound, {outbound} outbound dependencies"

    def _explain_usage(self, usage_data: Dict[str, Any]) -> str:
        """Generate explanation for production usage"""
        if not usage_data:
            return "No usage data available"
        requests = usage_data.get("request_count", 0)
        users = usage_data.get("user_count", 0)
        return f"{requests} requests, {users} users"

    def _explain_defect_density(self, defect_history: List[Dict[str, Any]]) -> str:
        """Generate explanation for defect density"""
        if not defect_history:
            return "No defect history"
        recent = len([d for d in defect_history if d.get("status") != "closed"])
        return f"{recent} open defects in related modules"


# Global instance
risk_based_planner = RiskBasedPlanner()

