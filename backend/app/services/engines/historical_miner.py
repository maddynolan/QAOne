"""
Historical Data Miner - Layer 5
Learns from past test cases and cross-application patterns.
"""

import logging
from typing import Dict, List, Any, Optional
from collections import defaultdict
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


class HistoricalDataMiner:
    """
    Mines historical test data to learn patterns.
    
    Layer 5 Components:
    1. Learn from past test cases
    2. Cross-application learning
    3. Pattern evolution tracking
    """
    
    def __init__(self):
        self.test_case_history = []
        self.pattern_evolution = defaultdict(list)
        self.cross_app_patterns = defaultdict(list)
    
    def analyze_historical_tests(
        self,
        test_cases: List[Dict[str, Any]],
        time_window_days: int = 90
    ) -> Dict[str, Any]:
        """
        Analyze historical test cases to extract patterns.
        
        Returns:
        {
            "common_patterns": [Dict],
            "field_frequencies": Dict,
            "validation_trends": Dict,
            "quality_metrics": Dict
        }
        """
        # Filter by time window
        cutoff_date = datetime.utcnow() - timedelta(days=time_window_days)
        recent_tests = [
            tc for tc in test_cases
            if self._parse_date(tc.get("created_at")) >= cutoff_date
        ]
        
        # Extract common patterns
        common_patterns = self._extract_common_patterns(recent_tests)
        
        # Calculate field frequencies
        field_frequencies = self._calculate_field_frequencies(recent_tests)
        
        # Analyze validation trends
        validation_trends = self._analyze_validation_trends(recent_tests)
        
        # Calculate quality metrics
        quality_metrics = self._calculate_quality_metrics(recent_tests)
        
        return {
            "common_patterns": common_patterns,
            "field_frequencies": field_frequencies,
            "validation_trends": validation_trends,
            "quality_metrics": quality_metrics,
            "sample_size": len(recent_tests)
        }
    
    def learn_cross_application(
        self,
        applications: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Learn patterns across multiple applications.
        
        Returns:
        {
            "universal_patterns": [Dict],
            "application_specific": Dict,
            "best_practices": [Dict]
        }
        """
        universal_patterns = []
        app_specific = {}
        
        # Extract patterns from each application
        all_patterns = []
        for app in applications:
            app_name = app.get("name", "unknown")
            forms = app.get("forms", [])
            
            app_patterns = self._extract_app_patterns(forms)
            app_specific[app_name] = app_patterns
            all_patterns.extend(app_patterns)
        
        # Find universal patterns (appear in >50% of applications)
        pattern_counts = defaultdict(int)
        for pattern in all_patterns:
            pattern_key = self._pattern_key(pattern)
            pattern_counts[pattern_key] += 1
        
        threshold = len(applications) * 0.5
        for pattern_key, count in pattern_counts.items():
            if count >= threshold:
                # Find original pattern
                for pattern in all_patterns:
                    if self._pattern_key(pattern) == pattern_key:
                        universal_patterns.append(pattern)
                        break
        
        # Extract best practices
        best_practices = self._extract_best_practices(applications)
        
        return {
            "universal_patterns": universal_patterns,
            "application_specific": app_specific,
            "best_practices": best_practices
        }
    
    def track_pattern_evolution(
        self,
        pattern_name: str,
        historical_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Track how a pattern evolves over time.
        
        Returns:
        {
            "pattern": str,
            "timeline": [Dict],
            "trends": Dict,
            "predictions": Dict
        }
        """
        timeline = []
        
        # Group by time periods
        for data_point in historical_data:
            date = self._parse_date(data_point.get("timestamp") or data_point.get("created_at"))
            if date:
                timeline.append({
                    "date": date.isoformat(),
                    "data": data_point
                })
        
        # Sort by date
        timeline.sort(key=lambda x: x["date"])
        
        # Analyze trends
        trends = self._analyze_trends(timeline)
        
        # Make predictions
        predictions = self._predict_future_trends(timeline, trends)
        
        return {
            "pattern": pattern_name,
            "timeline": timeline,
            "trends": trends,
            "predictions": predictions
        }
    
    def _extract_common_patterns(self, test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract common patterns from test cases."""
        patterns = defaultdict(int)
        
        for tc in test_cases:
            steps = tc.get("test_steps") or tc.get("steps", [])
            step_sequence = tuple([
                (step.get("action"), step.get("element_name"))
                for step in steps[:10]  # First 10 steps
            ])
            patterns[step_sequence] += 1
        
        # Return top patterns
        sorted_patterns = sorted(patterns.items(), key=lambda x: x[1], reverse=True)
        return [
            {
                "pattern": list(pattern),
                "frequency": count,
                "percentage": count / len(test_cases) * 100
            }
            for pattern, count in sorted_patterns[:10]
        ]
    
    def _calculate_field_frequencies(self, test_cases: List[Dict[str, Any]]) -> Dict[str, int]:
        """Calculate how often fields appear in test cases."""
        field_counts = defaultdict(int)
        
        for tc in test_cases:
            steps = tc.get("test_steps") or tc.get("steps", [])
            for step in steps:
                element_name = step.get("element_name")
                if element_name:
                    field_counts[element_name] += 1
        
        return dict(field_counts)
    
    def _analyze_validation_trends(self, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze validation rule trends over time."""
        validation_rules = defaultdict(int)
        
        for tc in test_cases:
            steps = tc.get("test_steps") or tc.get("steps", [])
            for step in steps:
                expected_result = step.get("expected_result", "")
                if "required" in expected_result.lower():
                    validation_rules["required"] += 1
                if "format" in expected_result.lower() or "pattern" in expected_result.lower():
                    validation_rules["format"] += 1
                if "length" in expected_result.lower() or "min" in expected_result.lower():
                    validation_rules["length"] += 1
        
        return dict(validation_rules)
    
    def _calculate_quality_metrics(self, test_cases: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate quality metrics from historical tests."""
        if not test_cases:
            return {}
        
        total_steps = sum(len(tc.get("test_steps") or tc.get("steps", [])) for tc in test_cases)
        avg_steps = total_steps / len(test_cases) if test_cases else 0
        
        # Calculate average confidence
        confidences = [tc.get("confidence_score", 0) for tc in test_cases if tc.get("confidence_score")]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        # Calculate coverage (simplified)
        unique_elements = set()
        for tc in test_cases:
            steps = tc.get("test_steps") or tc.get("steps", [])
            for step in steps:
                element = step.get("element_name")
                if element:
                    unique_elements.add(element)
        
        return {
            "average_steps": avg_steps,
            "average_confidence": avg_confidence,
            "unique_elements_tested": len(unique_elements),
            "total_test_cases": len(test_cases)
        }
    
    def _extract_app_patterns(self, forms: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract patterns from an application's forms."""
        patterns = []
        
        for form in forms:
            fields = form.get("fields", [])
            field_types = [f.get("type") for f in fields]
            pattern = {
                "form_type": form.get("type", "unknown"),
                "field_count": len(fields),
                "field_types": field_types,
                "has_validation": any(f.get("validation") for f in fields)
            }
            patterns.append(pattern)
        
        return patterns
    
    def _pattern_key(self, pattern: Dict[str, Any]) -> str:
        """Create a key for pattern comparison."""
        return json.dumps(pattern, sort_keys=True)
    
    def _extract_best_practices(self, applications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract best practices from applications."""
        practices = []
        
        # Practice 1: Forms with good validation
        for app in applications:
            forms = app.get("forms", [])
            for form in forms:
                fields = form.get("fields", [])
                validated_fields = sum(1 for f in fields if f.get("validation"))
                if validated_fields == len(fields) and len(fields) > 0:
                    practices.append({
                        "practice": "all_fields_validated",
                        "description": "All form fields have validation rules",
                        "example": app.get("name")
                    })
        
        return practices[:10]  # Top 10
    
    def _analyze_trends(self, timeline: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze trends in timeline data."""
        if len(timeline) < 2:
            return {}
        
        # Simple trend: increasing, decreasing, stable
        values = [d.get("data", {}).get("value", 0) for d in timeline]
        if values:
            first_half = sum(values[:len(values)//2]) / (len(values)//2) if len(values)//2 > 0 else 0
            second_half = sum(values[len(values)//2:]) / (len(values) - len(values)//2) if len(values) - len(values)//2 > 0 else 0
            
            if second_half > first_half * 1.1:
                trend = "increasing"
            elif second_half < first_half * 0.9:
                trend = "decreasing"
            else:
                trend = "stable"
            
            return {
                "trend": trend,
                "change_percentage": ((second_half - first_half) / first_half * 100) if first_half > 0 else 0
            }
        
        return {}
    
    def _predict_future_trends(
        self,
        timeline: List[Dict[str, Any]],
        trends: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Predict future trends based on historical data."""
        if not timeline or not trends:
            return {}
        
        # Simple linear prediction
        trend = trends.get("trend", "stable")
        change_pct = trends.get("change_percentage", 0)
        
        # Predict next period
        if trend == "increasing":
            prediction = "continue_increasing"
        elif trend == "decreasing":
            prediction = "continue_decreasing"
        else:
            prediction = "remain_stable"
        
        return {
            "prediction": prediction,
            "confidence": 0.7,  # Simplified
            "expected_change": change_pct
        }
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string to datetime."""
        if not date_str:
            return None
        
        try:
            if isinstance(date_str, str):
                # Try ISO format
                if "T" in date_str:
                    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                # Try other formats
                for fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M:%S"]:
                    try:
                        return datetime.strptime(date_str, fmt)
                    except ValueError:
                        continue
            return None
        except Exception:
            return None


