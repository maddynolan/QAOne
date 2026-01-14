"""
Step Validator & Cleaner
========================

Validates and cleans recorded steps before playback.
Catches "garbage steps" like:
- Clicks on React internal elements
- Invalid/empty selectors
- Duplicate consecutive actions
- Clicks on non-interactive elements

This runs as a POST-PROCESSING step on recorded flows,
ensuring cleaner playback without modifying the recorder.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class StepIssue(str, Enum):
    """Types of issues found in steps"""
    GARBAGE_SELECTOR = "garbage_selector"  # Internal React/framework selectors
    EMPTY_SELECTOR = "empty_selector"      # No usable selector
    DUPLICATE_STEP = "duplicate_step"      # Same as previous step
    NON_INTERACTIVE = "non_interactive"    # Click on generic div/span
    INTERNAL_ELEMENT = "internal_element"  # Framework internal element
    INVALID_VALUE = "invalid_value"        # Fill with empty/garbage value
    STALE_REFERENCE = "stale_reference"    # Dynamic ID that will fail


@dataclass
class ValidationResult:
    """Result of step validation"""
    valid: bool
    issues: List[StepIssue]
    suggestions: List[str]
    cleaned_step: Optional[Dict[str, Any]] = None


class StepValidator:
    """
    Validates and cleans recorded test steps.
    
    Use cases:
    1. Post-recording cleanup before saving
    2. Pre-playback validation
    3. Quality scoring of recorded flows
    """
    
    # Patterns that indicate garbage/internal selectors
    GARBAGE_PATTERNS = [
        # React internals
        r'__reactInternalInstance',
        r'__reactFiber',
        r'__reactProps',
        r'__reactEventHandlers',
        r'_react[A-Z]',
        r'react-select',  # Sometimes captured incorrectly
        
        # Framework build artifacts
        r'\$\$typeof',
        r'Symbol\(',
        r'\[object Object\]',
        r'undefined',
        r'null',
        
        # Dynamic IDs (will fail on replay)
        r'^:r\d+:$',  # Radix auto-generated
        r'^\d{13,}$',  # Timestamp IDs
        r'^[a-f0-9]{32,}$',  # Hash IDs
        r'^uid_\d+',
        r'^ember\d+$',
        r'^vue_',
        
        # Internal/invisible elements
        r'sr-only',
        r'visually-hidden',
        r'hidden',
        r'opacity-0',
        
        # Common garbage text
        r'^import\s',  # User mentioned "react import"
        r'^export\s',
        r'^function\s',
        r'^const\s',
        r'^let\s',
        r'^var\s',
    ]
    
    # Tags that usually aren't directly interactive
    NON_INTERACTIVE_TAGS = [
        'svg', 'path', 'g', 'circle', 'rect', 'line', 'polygon',  # SVG
        'br', 'hr', 'img',  # Non-interactive HTML
        'style', 'script', 'noscript',  # Never interactive
    ]
    
    # Tags that need special handling
    CONTAINER_TAGS = ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav']
    
    def __init__(self, strict_mode: bool = False):
        """
        Initialize validator.
        
        Args:
            strict_mode: If True, fails on any issue. If False, attempts to fix.
        """
        self.strict_mode = strict_mode
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for efficiency."""
        self.garbage_regex = [re.compile(p, re.IGNORECASE) for p in self.GARBAGE_PATTERNS]
    
    def validate_step(self, step: Dict[str, Any], previous_step: Optional[Dict[str, Any]] = None) -> ValidationResult:
        """
        Validate a single step.
        
        Args:
            step: The step to validate
            previous_step: Previous step (for duplicate detection)
            
        Returns:
            ValidationResult with issues and suggestions
        """
        issues = []
        suggestions = []
        
        step_type = step.get('type', step.get('action', '')).lower()
        
        # Check for empty/missing selector
        selector = self._get_selector(step)
        if not selector and step_type in ['click', 'fill', 'type', 'select']:
            issues.append(StepIssue.EMPTY_SELECTOR)
            suggestions.append("Step needs a selector - use recipe or add testId")
        
        # Check for garbage patterns
        if selector:
            for pattern in self.garbage_regex:
                if pattern.search(selector):
                    issues.append(StepIssue.GARBAGE_SELECTOR)
                    suggestions.append(f"Selector contains internal/garbage pattern: {pattern.pattern}")
                    break
        
        # Check element text for garbage
        element = step.get('element', {})
        text = element.get('text', '')
        if text:
            for pattern in self.garbage_regex:
                if pattern.search(text):
                    issues.append(StepIssue.INTERNAL_ELEMENT)
                    suggestions.append(f"Element text appears to be code/internal: {text[:50]}")
                    break
        
        # Check for non-interactive tags
        tag = element.get('tagName', '').lower()
        if tag in self.NON_INTERACTIVE_TAGS:
            issues.append(StepIssue.NON_INTERACTIVE)
            suggestions.append(f"Click on '{tag}' element is likely wrong - check parent element")
        
        # Check for generic containers without identifiers
        if tag in self.CONTAINER_TAGS and step_type == 'click':
            if not self._has_identifiers(element):
                issues.append(StepIssue.NON_INTERACTIVE)
                suggestions.append("Click on generic container without testId/role - needs better selector")
        
        # Check for duplicate consecutive steps
        if previous_step and self._is_duplicate(step, previous_step):
            issues.append(StepIssue.DUPLICATE_STEP)
            suggestions.append("Duplicate of previous step - consider removing")
        
        # Check for empty fill value
        if step_type == 'fill':
            value = step.get('value', '')
            if not value or value.strip() == '':
                issues.append(StepIssue.INVALID_VALUE)
                suggestions.append("Fill action has no value")
        
        # Check for dynamic IDs
        elem_id = element.get('id', '')
        if elem_id and self._is_dynamic_id(elem_id):
            issues.append(StepIssue.STALE_REFERENCE)
            suggestions.append(f"ID '{elem_id}' appears dynamic - will fail on replay")
        
        # Build result
        is_valid = len(issues) == 0
        cleaned_step = None
        
        if not is_valid and not self.strict_mode:
            # Try to clean the step
            cleaned_step = self._try_clean_step(step, issues)
            if cleaned_step:
                suggestions.append("Step was automatically cleaned")
        
        return ValidationResult(
            valid=is_valid,
            issues=issues,
            suggestions=suggestions,
            cleaned_step=cleaned_step
        )
    
    def validate_flow(self, steps: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Validate and clean an entire flow.
        
        Args:
            steps: List of steps to validate
            
        Returns:
            Tuple of (cleaned_steps, validation_report)
        """
        cleaned_steps = []
        removed_steps = []
        modified_steps = []
        all_issues = []
        
        previous_step = None
        
        for i, step in enumerate(steps):
            result = self.validate_step(step, previous_step)
            
            if result.valid:
                cleaned_steps.append(step)
                previous_step = step
            elif result.cleaned_step:
                cleaned_steps.append(result.cleaned_step)
                modified_steps.append({
                    'index': i,
                    'original': step,
                    'cleaned': result.cleaned_step,
                    'issues': [issue.value for issue in result.issues]
                })
                previous_step = result.cleaned_step
            else:
                # Step is invalid and couldn't be cleaned - remove it
                removed_steps.append({
                    'index': i,
                    'step': step,
                    'issues': [issue.value for issue in result.issues],
                    'suggestions': result.suggestions
                })
            
            all_issues.extend(result.issues)
        
        # Build report
        report = {
            'total_steps': len(steps),
            'valid_steps': len(cleaned_steps),
            'removed_steps': len(removed_steps),
            'modified_steps': len(modified_steps),
            'issues_found': len(all_issues),
            'issue_breakdown': self._count_issues(all_issues),
            'removed': removed_steps,
            'modified': modified_steps,
            'quality_score': self._calculate_quality_score(steps, cleaned_steps, all_issues)
        }
        
        return cleaned_steps, report
    
    def _get_selector(self, step: Dict[str, Any]) -> Optional[str]:
        """Extract the primary selector from a step."""
        # Try different locations
        if step.get('selector'):
            return step['selector']
        
        if step.get('selectorObj', {}).get('selector'):
            return step['selectorObj']['selector']
        
        element = step.get('element', {})
        selectors = element.get('selectors', [])
        if selectors and len(selectors) > 0:
            first = selectors[0]
            return first.get('selector', first.get('playwright', ''))
        
        return None
    
    def _has_identifiers(self, element: Dict[str, Any]) -> bool:
        """Check if element has meaningful identifiers."""
        return any([
            element.get('id') and not self._is_dynamic_id(element.get('id', '')),
            element.get('testId'),
            element.get('data-testid'),
            element.get('name'),
            element.get('ariaLabel'),
            element.get('role') in ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio']
        ])
    
    def _is_dynamic_id(self, id_value: str) -> bool:
        """Check if an ID looks dynamic."""
        if not id_value:
            return False
        
        dynamic_patterns = [
            r'^[a-f0-9]{8}-[a-f0-9]{4}-',  # UUID
            r'^\d{10,}$',                   # Timestamp
            r'^\d+$',                        # Pure numbers
            r'^:r\d+:$',                    # Radix
            r'^ember\d+$',                  # Ember
            r'^react-',                      # React
            r'^vue_',                        # Vue
            r'^aura\d+',                    # Salesforce Aura
            r'^lwc-\d+',                    # Salesforce LWC
            r'_\d{5,}$',                    # Ending with long numbers
        ]
        
        return any(re.match(p, id_value, re.IGNORECASE) for p in dynamic_patterns)
    
    def _is_duplicate(self, step: Dict[str, Any], previous: Dict[str, Any]) -> bool:
        """Check if step is duplicate of previous."""
        step_type = step.get('type', step.get('action', '')).lower()
        prev_type = previous.get('type', previous.get('action', '')).lower()
        
        if step_type != prev_type:
            return False
        
        # Check timestamps - same timestamp = definitely duplicate
        step_ts = step.get('timestamp', 0)
        prev_ts = previous.get('timestamp', 0)
        if step_ts and prev_ts and step_ts == prev_ts:
            return True
        
        # Check timestamps - within 500ms with same description = likely duplicate
        if step_ts and prev_ts and abs(step_ts - prev_ts) < 500:
            step_desc = step.get('description', '')
            prev_desc = previous.get('description', '')
            if step_desc and prev_desc and step_desc == prev_desc:
                return True
        
        # Compare selectors
        selector1 = self._get_selector(step)
        selector2 = self._get_selector(previous)
        
        if selector1 and selector2 and selector1 == selector2:
            # Same selector same action - likely duplicate
            # Also check if descriptions match
            step_desc = step.get('description', '')
            prev_desc = previous.get('description', '')
            if step_desc and prev_desc and step_desc == prev_desc:
                return True
        
        return False
    
    def _try_clean_step(self, step: Dict[str, Any], issues: List[StepIssue]) -> Optional[Dict[str, Any]]:
        """
        Try to clean a step by fixing issues.
        
        Returns cleaned step or None if unfixable.
        """
        cleaned = dict(step)
        element = dict(step.get('element', {}))
        cleaned['element'] = element
        
        # If selector is garbage, try alternatives
        if StepIssue.GARBAGE_SELECTOR in issues or StepIssue.STALE_REFERENCE in issues:
            selectors = element.get('selectors', [])
            
            # Find first non-garbage selector
            for sel in selectors:
                sel_value = sel.get('selector', sel.get('playwright', ''))
                if sel_value and not self._is_garbage_selector(sel_value):
                    # Check it's not a dynamic ID either
                    if not self._is_dynamic_id(sel_value):
                        cleaned['selector'] = sel_value
                        cleaned['_cleaned'] = True
                        return cleaned
            
            # Try to build from recipe if available
            recipe = step.get('recipe', {})
            if recipe:
                new_selector = self._build_selector_from_recipe(recipe)
                if new_selector:
                    cleaned['selector'] = new_selector
                    cleaned['_cleaned'] = True
                    return cleaned
            
            # Can't fix - unfixable garbage
            return None
        
        # If duplicate, just mark it (caller can decide to remove)
        if StepIssue.DUPLICATE_STEP in issues:
            cleaned['_duplicate'] = True
            return None  # Remove duplicates
        
        # If non-interactive, try to find parent
        if StepIssue.NON_INTERACTIVE in issues:
            # This would need DOM context we don't have here
            # Mark for manual review
            cleaned['_needs_review'] = True
            return cleaned
        
        return cleaned
    
    def _is_garbage_selector(self, selector: str) -> bool:
        """Check if selector matches garbage patterns."""
        for pattern in self.garbage_regex:
            if pattern.search(selector):
                return True
        return False
    
    def _build_selector_from_recipe(self, recipe: Dict[str, Any]) -> Optional[str]:
        """Build a selector from recipe data."""
        what = recipe.get('what', {})
        which = recipe.get('which', {})
        
        # TestID is most reliable
        test_id = which.get('testId')
        if test_id:
            return f"[data-testid='{test_id}']"
        
        # Role + name
        role = what.get('role')
        text = what.get('text')
        if role and text:
            return f"role={role}[name='{text}']"
        
        # Text
        if text:
            return f"text='{text}'"
        
        return None
    
    def _count_issues(self, issues: List[StepIssue]) -> Dict[str, int]:
        """Count occurrences of each issue type."""
        counts = {}
        for issue in issues:
            counts[issue.value] = counts.get(issue.value, 0) + 1
        return counts
    
    def _calculate_quality_score(
        self, 
        original: List[Dict[str, Any]], 
        cleaned: List[Dict[str, Any]], 
        issues: List[StepIssue]
    ) -> float:
        """
        Calculate quality score for the flow.
        
        100 = Perfect (no issues)
        0 = Completely garbage
        """
        if len(original) == 0:
            return 100.0
        
        # Factors:
        # - Retention rate (how many steps kept)
        # - Issue severity
        
        retention_rate = len(cleaned) / len(original)
        
        # Weight issues by severity
        severity_weights = {
            StepIssue.GARBAGE_SELECTOR: 10,
            StepIssue.EMPTY_SELECTOR: 8,
            StepIssue.INTERNAL_ELEMENT: 7,
            StepIssue.NON_INTERACTIVE: 5,
            StepIssue.STALE_REFERENCE: 6,
            StepIssue.DUPLICATE_STEP: 2,
            StepIssue.INVALID_VALUE: 4,
        }
        
        total_severity = sum(severity_weights.get(issue, 1) for issue in issues)
        max_severity = len(original) * 10  # Max if every step had worst issue
        
        severity_score = 1 - (total_severity / max_severity) if max_severity > 0 else 1
        
        # Combine scores
        quality = (retention_rate * 0.6 + severity_score * 0.4) * 100
        
        return round(max(0, min(100, quality)), 1)


# ============================================================================
# Convenience Functions
# ============================================================================

def validate_and_clean_flow(steps: List[Dict[str, Any]], strict: bool = False) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Validate and clean a recorded flow.
    
    Args:
        steps: List of recorded steps
        strict: If True, don't attempt to fix issues
        
    Returns:
        Tuple of (cleaned_steps, report)
    """
    validator = StepValidator(strict_mode=strict)
    return validator.validate_flow(steps)


def get_flow_quality_score(steps: List[Dict[str, Any]]) -> float:
    """
    Get quality score for a recorded flow.
    
    Returns a score from 0-100.
    """
    validator = StepValidator()
    _, report = validator.validate_flow(steps)
    return report['quality_score']
