"""
Requirement Comparator
Compares new requirements against discovered capability map.
Identifies gaps, partial support, conflicts, and impact areas.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SupportStatus(Enum):
    """Status of requirement support."""
    FULLY_SUPPORTED = "fully_supported"
    PARTIALLY_SUPPORTED = "partially_supported"
    NOT_SUPPORTED = "not_supported"
    CONFLICTING = "conflicting"


@dataclass
class RequirementMatch:
    """Result of comparing a requirement against capabilities."""
    requirement_id: str
    status: SupportStatus
    confidence: float  # 0.0 to 1.0
    matched_capabilities: List[Dict[str, Any]] = field(default_factory=list)
    gaps: List[str] = field(default_factory=list)
    conflicts: List[str] = field(default_factory=list)
    impacted_pages: List[str] = field(default_factory=list)
    suggested_tests: List[Dict[str, Any]] = field(default_factory=list)
    impact_type: str = ""  # "ui_only", "backend_rules", "new_flow", "data_model"


class RequirementComparator:
    """
    Compares new requirements against discovered capability map.
    Uses semantic matching to find closest capabilities and identify gaps.
    """
    
    def __init__(self):
        pass
    
    async def compare_requirements(
        self,
        requirements: List[Dict[str, Any]],
        capability_map: Dict[str, Any]
    ) -> List[RequirementMatch]:
        """
        Compare requirements against capability map.
        
        Args:
            requirements: List of requirement objects (from Jira/parsing)
            capability_map: Output from CapabilityMapBuilder
        
        Returns:
            List of RequirementMatch objects with status, gaps, and impact
        """
        logger.info(f"Comparing {len(requirements)} requirements against capability map")
        
        matches = []
        capabilities = capability_map.get('entities', [])
        
        for req in requirements:
            match = await self._match_requirement(req, capabilities, capability_map)
            matches.append(match)
        
        logger.info(f"Comparison complete: {len([m for m in matches if m.status == SupportStatus.FULLY_SUPPORTED])} fully supported")
        return matches
    
    async def _match_requirement(
        self,
        requirement: Dict[str, Any],
        capabilities: List[Dict[str, Any]],
        capability_map: Dict[str, Any]
    ) -> RequirementMatch:
        """Match a single requirement against capabilities."""
        req_entity = requirement.get('entity', '').lower()
        req_operation = requirement.get('operation', '').lower()
        req_fields = requirement.get('fields', [])
        
        # Find matching capabilities
        matched_caps = []
        for cap in capabilities:
            cap_entity = cap.get('entity', '').lower()
            cap_operation = cap.get('operation', '').lower()
            
            # Entity match
            entity_match = self._semantic_match(req_entity, cap_entity)
            
            # Operation match
            operation_match = self._semantic_match(req_operation, cap_operation)
            
            if entity_match > 0.7 and operation_match > 0.7:
                matched_caps.append({
                    'capability': cap,
                    'entity_similarity': entity_match,
                    'operation_similarity': operation_match,
                    'overall_similarity': (entity_match + operation_match) / 2
                })
        
        # Sort by similarity
        matched_caps.sort(key=lambda x: x['overall_similarity'], reverse=True)
        
        if not matched_caps:
            # No match found
            return RequirementMatch(
                requirement_id=requirement.get('id', ''),
                status=SupportStatus.NOT_SUPPORTED,
                confidence=0.0,
                suggested_tests=self._suggest_tests_for_new_requirement(requirement)
            )
        
        best_match = matched_caps[0]
        best_cap = best_match['capability']
        
        # Check for gaps and conflicts
        gaps = self._identify_gaps(requirement, best_cap)
        conflicts = self._identify_conflicts(requirement, best_cap)
        
        # Determine status
        if not gaps and not conflicts:
            status = SupportStatus.FULLY_SUPPORTED
        elif conflicts:
            status = SupportStatus.CONFLICTING
        elif len(gaps) < len(req_fields) * 0.3:  # Less than 30% gaps
            status = SupportStatus.PARTIALLY_SUPPORTED
        else:
            status = SupportStatus.PARTIALLY_SUPPORTED
        
        # Identify impacted pages
        impacted_pages = best_cap.get('source_pages', [])
        
        # Determine impact type
        impact_type = self._determine_impact_type(gaps, conflicts, requirement)
        
        # Suggest tests
        suggested_tests = self._suggest_tests(requirement, best_cap, status, gaps)
        
        return RequirementMatch(
            requirement_id=requirement.get('id', ''),
            status=status,
            confidence=best_match['overall_similarity'],
            matched_capabilities=[best_cap],
            gaps=gaps,
            conflicts=conflicts,
            impacted_pages=impacted_pages,
            suggested_tests=suggested_tests,
            impact_type=impact_type
        )
    
    def _semantic_match(self, text1: str, text2: str) -> float:
        """Simple semantic matching (can be enhanced with embeddings)."""
        if not text1 or not text2:
            return 0.0
        
        # Exact match
        if text1 == text2:
            return 1.0
        
        # Substring match
        if text1 in text2 or text2 in text1:
            return 0.8
        
        # Word overlap
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _identify_gaps(self, requirement: Dict[str, Any], capability: Dict[str, Any]) -> List[str]:
        """Identify gaps between requirement and capability."""
        gaps = []
        
        req_fields = {f.get('name', '').lower(): f for f in requirement.get('fields', [])}
        cap_fields = {f.get('name', '').lower(): f for f in capability.get('fields', [])}
        
        # Missing fields
        for req_field_name, req_field in req_fields.items():
            if req_field_name not in cap_fields:
                gaps.append(f"Missing field: {req_field.get('label', req_field_name)}")
            else:
                # Check field properties
                cap_field = cap_fields[req_field_name]
                if req_field.get('required') and not cap_field.get('required'):
                    gaps.append(f"Field {req_field_name} should be required")
                
                # Check options for select fields
                if req_field.get('options') and cap_field.get('options'):
                    req_options = set(o.lower() for o in req_field.get('options', []))
                    cap_options = set(o.get('text', '').lower() for o in cap_field.get('options', []))
                    missing_options = req_options - cap_options
                    if missing_options:
                        gaps.append(f"Field {req_field_name} missing options: {', '.join(missing_options)}")
        
        # Missing validations
        req_validations = requirement.get('validations', [])
        cap_validations = capability.get('validations', [])
        for req_val in req_validations:
            if not any(self._validation_match(req_val, cap_val) for cap_val in cap_validations):
                gaps.append(f"Missing validation: {req_val.get('type')} on {req_val.get('field')}")
        
        return gaps
    
    def _identify_conflicts(self, requirement: Dict[str, Any], capability: Dict[str, Any]) -> List[str]:
        """Identify conflicts between requirement and capability."""
        conflicts = []
        
        # Role conflicts
        req_roles = set(r.lower() for r in requirement.get('roles', []))
        cap_roles = set(r.lower() for r in capability.get('roles', []))
        
        if req_roles and cap_roles:
            # Check if requirement restricts access more than capability
            if req_roles != cap_roles:
                conflicts.append(f"Role mismatch: requirement allows {req_roles}, capability allows {cap_roles}")
        
        # Field type conflicts
        req_fields = {f.get('name', '').lower(): f for f in requirement.get('fields', [])}
        cap_fields = {f.get('name', '').lower(): f for f in capability.get('fields', [])}
        
        for field_name in req_fields.keys() & cap_fields.keys():
            req_field = req_fields[field_name]
            cap_field = cap_fields[field_name]
            
            if req_field.get('type') != cap_field.get('type'):
                conflicts.append(f"Field {field_name} type mismatch: requirement={req_field.get('type')}, capability={cap_field.get('type')}")
        
        return conflicts
    
    def _validation_match(self, req_val: Dict, cap_val: Dict) -> bool:
        """Check if validations match."""
        return (
            req_val.get('type') == cap_val.get('type') and
            req_val.get('field', '').lower() == cap_val.get('field', '').lower()
        )
    
    def _determine_impact_type(self, gaps: List[str], conflicts: List[str], requirement: Dict[str, Any]) -> str:
        """Determine the type of impact for this requirement."""
        if not gaps and not conflicts:
            return "none"
        
        # Check if it's just UI changes (new fields on existing form)
        ui_only_keywords = ['missing field', 'field should be', 'missing options']
        if any(keyword in gap.lower() for gap in gaps for keyword in ui_only_keywords):
            if not any('validation' in gap.lower() for gap in gaps):
                return "ui_only"
        
        # Check if it's backend rules (validations, permissions)
        if any('validation' in gap.lower() or 'role' in gap.lower() for gap in gaps + conflicts):
            return "backend_rules"
        
        # Check if it's a new flow (no matching capability)
        if not gaps:  # This shouldn't happen, but handle it
            return "new_flow"
        
        # Check if it's data model changes
        if any('type mismatch' in conflict.lower() for conflict in conflicts):
            return "data_model"
        
        return "new_flow"
    
    def _suggest_tests(self, requirement: Dict, capability: Dict, status: SupportStatus, gaps: List[str]) -> List[Dict[str, Any]]:
        """Suggest test cases based on requirement and gaps."""
        tests = []
        
        entity = requirement.get('entity', '')
        operation = requirement.get('operation', '')
        
        if status == SupportStatus.FULLY_SUPPORTED:
            # Test that existing functionality works
            tests.append({
                'title': f"Verify {operation} {entity} functionality",
                'type': 'functional',
                'priority': 'high',
                'steps': [
                    f"Navigate to {entity} {operation} page",
                    f"Fill required fields",
                    f"Submit form",
                    f"Verify {entity} is {operation.lower()}d successfully"
                ]
            })
        elif status == SupportStatus.PARTIALLY_SUPPORTED:
            # Test new fields/features
            for gap in gaps:
                if 'field' in gap.lower():
                    tests.append({
                        'title': f"Test new field: {gap}",
                        'type': 'functional',
                        'priority': 'medium',
                        'steps': [
                            f"Navigate to {entity} {operation} page",
                            f"Verify new field is present",
                            f"Test field validation",
                            f"Submit form with new field"
                        ]
                    })
        else:  # NOT_SUPPORTED or CONFLICTING
            tests.append({
                'title': f"Test {operation} {entity} (new feature)",
                'type': 'functional',
                'priority': 'high',
                'steps': [
                    f"Navigate to {entity} {operation} page",
                    f"Verify all required fields are present",
                    f"Test all validations",
                    f"Submit and verify success"
                ]
            })
        
        return tests
    
    def _suggest_tests_for_new_requirement(self, requirement: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Suggest tests for a completely new requirement."""
        entity = requirement.get('entity', '')
        operation = requirement.get('operation', '')
        
        return [{
            'title': f"Test {operation} {entity} (new feature)",
            'type': 'functional',
            'priority': 'high',
            'steps': [
                f"Navigate to {entity} {operation} page",
                f"Verify page loads correctly",
                f"Fill all required fields",
                f"Test validations",
                f"Submit form",
                f"Verify {entity} is {operation.lower()}d successfully"
            ]
        }]

