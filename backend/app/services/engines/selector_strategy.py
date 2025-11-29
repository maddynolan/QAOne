"""
Advanced Selector Strategy Engine
Implements multi-strategy selector generation with confidence scoring
Based on industry best practices for robust test automation
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SelectorCandidate:
    """Represents a selector candidate with metadata"""
    selector: str
    strategy: str
    confidence: float  # 0.0 to 1.0
    priority: int  # Lower = higher priority
    description: str
    fallback_order: int  # Order to try if primary fails


class SelectorStrategyEngine:
    """
    Advanced selector strategy engine for robust test automation.
    
    Implements industry best practices:
    1. data-testid (highest priority - most stable)
    2. ARIA attributes (aria-label, aria-labelledby, role)
    3. Semantic HTML (button, input, form elements)
    4. Stable IDs (non-dynamic)
    5. Name attributes (form fields)
    6. Text content (with context)
    7. CSS selectors (last resort)
    
    Each strategy includes:
    - Confidence score (0.0-1.0)
    - Fallback order
    - Stability rating
    """
    
    def __init__(self):
        # Strategy priorities (lower = higher priority)
        self.strategy_priorities = {
            "data_testid": 1,
            "aria_label": 2,
            "aria_labelledby": 3,
            "role": 4,
            "semantic_id": 5,
            "name_attribute": 6,
            "stable_id": 7,
            "text_content": 8,
            "css_selector": 9,
            "xpath": 10
        }
        
        # Dynamic ID patterns (to avoid)
        self.dynamic_id_patterns = [
            r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',  # UUID
            r'^react-.*$',  # React IDs
            r'^vue-.*$',  # Vue IDs
            r'^angular-.*$',  # Angular IDs
            r'^ember-.*$',  # Ember IDs
            r'^[0-9]+$',  # Numeric only
            r'^id-[0-9]+$',  # id-123
            r'^element-[0-9]+$',  # element-123
        ]
        
        # Utility CSS classes to ignore (common in utility-first frameworks)
        self.utility_classes = {
            'flex', 'items-center', 'justify-center', 'w-100', 'h-100',
            'p-1', 'p-2', 'p-3', 'p-4', 'm-1', 'm-2', 'm-3', 'm-4',
            'mt-1', 'mt-2', 'mb-1', 'mb-2', 'ml-1', 'ml-2', 'mr-1', 'mr-2',
            'pa-1', 'pa-2', 'ph-1', 'ph-2', 'pv-1', 'pv-2',
            'bg-transparent', 'bg-white', 'bg-black',
            'tc', 'tl', 'tr', 'db', 'dn', 'bn', 'pointer',
            'sans-serif', 'serif', 'b', 'i', 'u', 'underline',
            'shadow-1', 'shadow-2', 'nowrap', 'lh-title', 'lh-copy',
            'w_hhLG', 'w_DZvO', 'w_0_LY', 'w_8nsR', 'w_lgOn', 'w_jDfj',
            'ld', 'ld-ChevronDown', 'ld-Plus', 'ld-Cart', 'ld-Minus',
            'pl2', 'pr0', 'pr1', 'pr2', 'mt1', 'mb1', 'mr1', 'mr2', 'mr4', 'mr5',
            'pa0', 'pa1', 'ph4', 'pv2', 'ma0', 'mh0', 'mv0',
            'mid-gray', 'navy', 'white', 'black', 'red',
            'redesigned', 'cart-total', 'redesigned-cart-total'
        }
    
    def generate_selector_candidates(
        self,
        element_data: Dict[str, Any],
        dom_context: Optional[Dict[str, Any]] = None
    ) -> List[SelectorCandidate]:
        """
        Generate multiple selector candidates with confidence scores.
        
        Args:
            element_data: Element data from DOM snapshot or action graph
            dom_context: Optional DOM context for parent/sibling analysis
            
        Returns:
            List of SelectorCandidate objects, sorted by priority
        """
        candidates = []
        
        # Strategy 1: data-testid (highest priority - most stable)
        if element_data.get("data_testid") or element_data.get("data-testid"):
            testid = element_data.get("data_testid") or element_data.get("data-testid")
            candidates.append(SelectorCandidate(
                selector=f'[data-testid="{testid}"]',
                strategy="data_testid",
                confidence=0.98,
                priority=1,
                description=f"data-testid: {testid}",
                fallback_order=1
            ))
        
        # Strategy 2: ARIA label
        if element_data.get("aria_label") or element_data.get("aria-label"):
            aria_label = element_data.get("aria_label") or element_data.get("aria-label")
            if aria_label and len(aria_label.strip()) > 0:
                candidates.append(SelectorCandidate(
                    selector=f'[aria-label="{aria_label}"]',
                    strategy="aria_label",
                    confidence=0.95,
                    priority=2,
                    description=f"ARIA label: {aria_label}",
                    fallback_order=2
                ))
        
        # Strategy 3: ARIA labelledby
        if element_data.get("aria_labelledby") or element_data.get("aria-labelledby"):
            labelledby = element_data.get("aria_labelledby") or element_data.get("aria-labelledby")
            candidates.append(SelectorCandidate(
                selector=f'[aria-labelledby="{labelledby}"]',
                strategy="aria_labelledby",
                confidence=0.93,
                priority=3,
                description=f"ARIA labelledby: {labelledby}",
                fallback_order=3
            ))
        
        # Strategy 4: Role attribute
        if element_data.get("role"):
            role = element_data.get("role")
            # Combine with other attributes for better specificity
            if element_data.get("aria_label") or element_data.get("aria-label"):
                aria_label = element_data.get("aria_label") or element_data.get("aria-label")
                candidates.append(SelectorCandidate(
                    selector=f'[role="{role}"][aria-label="{aria_label}"]',
                    strategy="role",
                    confidence=0.90,
                    priority=4,
                    description=f"Role: {role} with aria-label",
                    fallback_order=4
                ))
            else:
                candidates.append(SelectorCandidate(
                    selector=f'[role="{role}"]',
                    strategy="role",
                    confidence=0.85,
                    priority=4,
                    description=f"Role: {role}",
                    fallback_order=4
                ))
        
        # Strategy 5: Stable ID (non-dynamic)
        element_id = element_data.get("id") or element_data.get("element_id")
        if element_id and self._is_stable_id(element_id):
            candidates.append(SelectorCandidate(
                selector=f'#{element_id}',
                strategy="semantic_id",
                confidence=0.92,
                priority=5,
                description=f"Stable ID: {element_id}",
                fallback_order=5
            ))
        
        # Strategy 6: Name attribute (form fields)
        if element_data.get("name"):
            name = element_data.get("name")
            tag = element_data.get("tag", "").lower()
            if tag in ["input", "select", "textarea", "button"]:
                candidates.append(SelectorCandidate(
                    selector=f'[name="{name}"]',
                    strategy="name_attribute",
                    confidence=0.88,
                    priority=6,
                    description=f"Name attribute: {name}",
                    fallback_order=6
                ))
        
        # Strategy 7: Semantic HTML + text content
        tag = element_data.get("tag", "").lower()
        text_content = element_data.get("text") or element_data.get("text_content") or element_data.get("textContent")
        if text_content and tag in ["button", "a", "label", "span", "div"]:
            # Clean text content
            clean_text = text_content.strip()[:50]  # Limit length
            if len(clean_text) > 0 and len(clean_text) < 50:
                # Use text content with tag
                candidates.append(SelectorCandidate(
                    selector=f'{tag}:has-text("{clean_text}")',
                    strategy="text_content",
                    confidence=0.75,
                    priority=8,
                    description=f"Text content: {clean_text[:30]}...",
                    fallback_order=8
                ))
        
        # Strategy 8: CSS selector (filtered, meaningful classes only)
        css_selector = self._generate_meaningful_css_selector(element_data)
        if css_selector:
            candidates.append(SelectorCandidate(
                selector=css_selector,
                strategy="css_selector",
                confidence=0.60,
                priority=9,
                description="CSS selector (filtered classes)",
                fallback_order=9
            ))
        
        # Sort by priority (lower = higher priority)
        candidates.sort(key=lambda x: (x.priority, -x.confidence))
        
        return candidates
    
    def _is_stable_id(self, element_id: str) -> bool:
        """Check if an ID is stable (not dynamically generated)"""
        if not element_id:
            return False
        
        # Check against dynamic patterns
        for pattern in self.dynamic_id_patterns:
            if re.match(pattern, element_id, re.I):
                return False
        
        # Check length (very short or very long IDs are often dynamic)
        if len(element_id) < 3 or len(element_id) > 50:
            return False
        
        # Check for common stable patterns
        stable_patterns = [
            r'^[a-z][a-z0-9_-]+$',  # camelCase, kebab-case, snake_case
            r'^[A-Z][a-zA-Z0-9]+$',  # PascalCase
        ]
        
        for pattern in stable_patterns:
            if re.match(pattern, element_id):
                return True
        
        return False
    
    def _generate_meaningful_css_selector(self, element_data: Dict[str, Any]) -> Optional[str]:
        """Generate CSS selector using only meaningful classes (filter out utilities)"""
        tag = element_data.get("tag", "").lower()
        classes = element_data.get("class") or element_data.get("class_name") or element_data.get("className")
        
        if not classes:
            return None
        
        # Parse classes
        if isinstance(classes, str):
            class_list = classes.split()
        elif isinstance(classes, list):
            class_list = classes
        else:
            return None
        
        # Filter out utility classes
        meaningful_classes = [
            cls for cls in class_list
            if cls not in self.utility_classes and len(cls) > 3
        ]
        
        if not meaningful_classes:
            return None
        
        # Build selector with meaningful classes only
        class_selector = '.'.join(meaningful_classes[:3])  # Limit to 3 classes max
        return f'{tag}.{class_selector}' if tag else f'.{class_selector}'
    
    def get_best_selector(
        self,
        element_data: Dict[str, Any],
        dom_context: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, float]:
        """
        Get the best selector candidate.
        
        Returns:
            Tuple of (selector, confidence_score)
        """
        candidates = self.generate_selector_candidates(element_data, dom_context)
        
        if not candidates:
            # Fallback to basic selector
            tag = element_data.get("tag", "div")
            return (tag, 0.3)
        
        best = candidates[0]
        return (best.selector, best.confidence)
    
    def get_selector_with_fallback(
        self,
        element_data: Dict[str, Any],
        dom_context: Optional[Dict[str, Any]] = None,
        max_fallbacks: int = 3
    ) -> Dict[str, Any]:
        """
        Get selector with fallback chain.
        
        Returns:
            Dict with primary selector and fallback list
        """
        candidates = self.generate_selector_candidates(element_data, dom_context)
        
        if not candidates:
            tag = element_data.get("tag", "div")
            return {
                "primary": tag,
                "fallbacks": [],
                "confidence": 0.3
            }
        
        primary = candidates[0]
        fallbacks = [
            {
                "selector": c.selector,
                "strategy": c.strategy,
                "confidence": c.confidence
            }
            for c in candidates[1:max_fallbacks+1]
        ]
        
        return {
            "primary": primary.selector,
            "fallbacks": fallbacks,
            "confidence": primary.confidence,
            "strategy": primary.strategy,
            "description": primary.description
        }


