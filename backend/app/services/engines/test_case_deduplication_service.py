"""
Test Case Deduplication Service
Deduplicates similar test cases using signature-based similarity matching
"""

import logging
from typing import List, Set, Dict, Any
from app.schemas.requirement_schemas import TestCase

logger = logging.getLogger(__name__)


class TestCaseDeduplicationService:
    """
    Service for deduplicating similar test cases.
    Uses signature-based similarity matching to identify and remove duplicates.
    """
    
    def __init__(self, similarity_threshold: float = 0.85):
        """
        Initialize deduplication service.
        
        Args:
            similarity_threshold: Similarity threshold (0.0-1.0). Test cases with similarity > threshold are considered duplicates.
        """
        self.similarity_threshold = similarity_threshold
        logger.info(f"TestCaseDeduplicationService initialized with threshold: {similarity_threshold}")
    
    def deduplicate(self, test_cases: List[TestCase]) -> List[TestCase]:
        """
        Deduplicate test cases by comparing titles and step sequences.
        Keeps the most complete test case from each group of similar ones.
        
        Args:
            test_cases: List of test cases to deduplicate
            
        Returns:
            List of deduplicated test cases
        """
        if len(test_cases) <= 1:
            return test_cases
        
        logger.info(f"Deduplicating {len(test_cases)} test cases (threshold: {self.similarity_threshold})")
        
        # Group test cases by similarity
        groups = []
        used_indices = set()
        
        for i, test_case in enumerate(test_cases):
            if i in used_indices:
                continue
            
            # Create signature for this test case
            signature = self._create_signature(test_case)
            
            # Find similar test cases
            similar_group = [test_case]
            used_indices.add(i)
            
            for j, other_case in enumerate(test_cases[i+1:], start=i+1):
                if j in used_indices:
                    continue
                
                other_signature = self._create_signature(other_case)
                similarity = self._calculate_similarity(signature, other_signature)
                
                if similarity > self.similarity_threshold:
                    similar_group.append(other_case)
                    used_indices.add(j)
            
            groups.append(similar_group)
        
        # Keep one from each group (prefer higher priority or more complete)
        deduplicated = []
        for group in groups:
            if len(group) == 1:
                deduplicated.append(group[0])
            else:
                # Choose best test case from group
                best = self._choose_best(group)
                deduplicated.append(best)
                logger.info(f"Deduplicated {len(group)} similar test cases, kept: '{best.title}'")
        
        logger.info(f"Deduplication complete: {len(test_cases)} -> {len(deduplicated)} test cases")
        return deduplicated
    
    def _create_signature(self, test_case: TestCase) -> str:
        """
        Create a signature for a test case based on title and key steps.
        Variations should have distinct signatures.
        """
        # Normalize title
        title_lower = test_case.title.lower()
        
        # Extract key words from title - be more specific to distinguish variations
        key_words = []
        
        # Payee variations
        if "new payee" in title_lower or ("add" in title_lower and "payee" in title_lower and "new" in title_lower):
            key_words.append("add_payee")
        elif "saved payee" in title_lower:
            key_words.append("saved_payee")
        
        # Frequency variations - these should be distinct
        if "quarterly" in title_lower:
            key_words.append("freq_quarterly")
        elif "yearly" in title_lower:
            key_words.append("freq_yearly")
        elif "monthly" in title_lower and "not monthly" not in title_lower:
            key_words.append("freq_monthly")
        
        # End date variations
        if "specific end date" in title_lower or ("end date" in title_lower and "until cancelled" not in title_lower and "specific" in title_lower):
            key_words.append("end_date_specific")
        elif "until cancelled" in title_lower:
            key_words.append("end_date_until_cancelled")
        
        # Test type
        kind_str = str(test_case.kind).lower() if test_case.kind else ""
        if "validation" in kind_str or "validation" in title_lower:
            key_words.append("type_validation")
        elif "management" in kind_str or "management" in title_lower:
            key_words.append("type_management")
        elif "variation" in kind_str or "variation" in title_lower:
            key_words.append("type_variation")
        elif "happy" in kind_str or "happy" in title_lower:
            key_words.append("type_happy_path")
        
        # Extract first few step actions - look for variation indicators
        step_actions = []
        for step in test_case.steps[:8]:  # First 8 steps to catch variations
            action_lower = step.action.lower()
            if "add new" in action_lower or ("new payee" in action_lower and "add" in action_lower):
                step_actions.append("step_add_payee")
            elif "frequency" in action_lower or "set.*frequency" in action_lower:
                if "quarterly" in action_lower or ("not" in action_lower and "monthly" in action_lower):
                    step_actions.append("step_freq_quarterly")
                elif "yearly" in action_lower:
                    step_actions.append("step_freq_yearly")
                elif "monthly" in action_lower:
                    step_actions.append("step_freq_monthly")
            elif "end date" in action_lower:
                if "specific" in action_lower or ("not" in action_lower and "until cancelled" in action_lower):
                    step_actions.append("step_end_date_specific")
                elif "until cancelled" in action_lower:
                    step_actions.append("step_end_date_until_cancelled")
        
        # Combine key words and step actions - variations should have distinct signatures
        signature = f"{':'.join(sorted(set(key_words)))}:{':'.join(sorted(set(step_actions)))}"
        return signature
    
    def _calculate_similarity(self, sig1: str, sig2: str) -> float:
        """
        Calculate similarity between two signatures (0.0 to 1.0).
        Uses Jaccard similarity.
        """
        if not sig1 or not sig2:
            return 0.0
        
        # Split signatures
        parts1 = set(sig1.split(':'))
        parts2 = set(sig2.split(':'))
        
        if not parts1 or not parts2:
            return 0.0
        
        # Calculate Jaccard similarity
        intersection = len(parts1 & parts2)
        union = len(parts1 | parts2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def _choose_best(self, group: List[TestCase]) -> TestCase:
        """
        Choose the best test case from a group of similar ones.
        Prefers test cases with:
        - More specific titles (longer, more descriptive)
        - More steps (more complete)
        - Higher priority
        - Variation type (more specific)
        """
        if len(group) == 1:
            return group[0]
        
        def score(tc: TestCase) -> float:
            score = 0.0
            
            # Title specificity (longer = more specific)
            score += len(tc.title) * 0.01
            
            # Number of steps (more = more complete)
            score += len(tc.steps) * 0.1
            
            # Priority (high > medium > low)
            priority_scores = {"high": 3, "medium": 2, "low": 1}
            priority_str = tc.priority.value.lower() if hasattr(tc.priority, 'value') else str(tc.priority).lower()
            score += priority_scores.get(priority_str, 1)
            
            # Variation type bonus (more specific)
            kind_str = str(tc.kind).lower() if tc.kind else ""
            if "variation" in kind_str:
                score += 0.5
            if any("quarterly" in tag.lower() or "yearly" in tag.lower() or "end date" in tag.lower() 
                   for tag in (tc.tags or [])):
                score += 1.0
            
            return score
        
        return max(group, key=score)




