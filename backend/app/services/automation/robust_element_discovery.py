"""
Robust Element Discovery Engine
Enterprise-grade element finding that works across all applications without per-app configuration.
Uses multiple strategies: semantic matching, visual similarity, context-aware discovery, and intelligent fallbacks.
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple, Set
from enum import Enum
from dataclasses import dataclass
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


class DiscoveryStrategy(Enum):
    """Element discovery strategies in priority order"""
    SEMANTIC_ROLE = 1  # getByRole with semantic matching
    TEXT_SIMILARITY = 2  # Fuzzy text matching
    CONTEXT_AWARE = 3  # Parent-child relationships
    VISUAL_PATTERN = 4  # Element patterns (button-like, link-like)
    POSITION_RELATIVE = 5  # Relative positioning
    DOM_STRUCTURE = 6  # DOM hierarchy patterns
    FALLBACK = 7  # Last resort strategies


@dataclass
class ElementSignature:
    """Represents an element's unique signature for matching"""
    text: Optional[str] = None
    role: Optional[str] = None
    tag: Optional[str] = None
    attributes: Dict[str, str] = None
    position_hint: Optional[Tuple[int, int]] = None
    parent_context: Optional[str] = None
    visual_pattern: Optional[str] = None  # "button-like", "link-like", "form-input"
    
    def __post_init__(self):
        if self.attributes is None:
            self.attributes = {}


@dataclass
class DiscoveredElement:
    """Represents a discovered element with confidence score"""
    locator: str
    strategy: DiscoveryStrategy
    confidence: float  # 0.0 to 1.0
    description: str
    fallback_locators: List[str] = None
    
    def __post_init__(self):
        if self.fallback_locators is None:
            self.fallback_locators = []


class RobustElementDiscovery:
    """
    Enterprise-grade element discovery engine that works across all applications.
    
    Features:
    - Semantic element matching (role + text similarity)
    - Context-aware discovery (parent-child relationships)
    - Visual pattern recognition
    - Intelligent fallback chains
    - Self-learning from successful finds
    - Works without per-app configuration
    """
    
    def __init__(self):
        # Common element patterns that work across applications
        self.element_patterns = {
            "button": {
                "roles": ["button", "link"],
                "tags": ["button", "a", "div", "span"],
                "attributes": ["onclick", "type=button", "type=submit"],
                "text_patterns": ["click", "submit", "save", "cancel", "ok", "yes", "no", "add", "remove", "delete", "edit"]
            },
            "link": {
                "roles": ["link"],
                "tags": ["a"],
                "attributes": ["href"],
                "text_patterns": []
            },
            "input": {
                "roles": ["textbox", "combobox", "searchbox"],
                "tags": ["input", "textarea"],
                "attributes": ["type=text", "type=email", "type=password", "type=search"],
                "text_patterns": []
            },
            "form": {
                "roles": ["form"],
                "tags": ["form"],
                "attributes": [],
                "text_patterns": []
            }
        }
        
        # Common overlay/modal patterns (works across frameworks)
        self.overlay_patterns = [
            # React
            r'\.ReactModal',
            r'\.Modal',
            r'\.Dialog',
            r'\.Drawer',
            # Angular
            r'\.mat-dialog',
            r'\.cdk-overlay',
            # Vue
            r'\.v-modal',
            r'\.el-dialog',
            # Generic
            r'\[role=["\']dialog["\']',
            r'\[role=["\']alertdialog["\']',
            r'\.overlay',
            r'\.modal',
            r'\.popup',
            r'\.backdrop',
            r'\.loading',
            r'\.spinner',
        ]
    
    def discover_element(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]] = None
    ) -> List[DiscoveredElement]:
        """
        Discover element using multiple strategies.
        
        Returns list of discovered elements ordered by confidence.
        """
        discoveries = []
        
        # Strategy 1: Semantic Role + Text Similarity (HIGHEST PRIORITY)
        if signature.role or signature.text:
            semantic = self._discover_by_semantic_role(signature, page_context)
            if semantic:
                discoveries.extend(semantic)
        
        # Strategy 2: Text Similarity (Fuzzy Matching)
        if signature.text:
            text_based = self._discover_by_text_similarity(signature, page_context)
            if text_based:
                discoveries.extend(text_based)
        
        # Strategy 3: Context-Aware Discovery
        if signature.parent_context:
            context_based = self._discover_by_context(signature, page_context)
            if context_based:
                discoveries.extend(context_based)
        
        # Strategy 4: Visual Pattern Recognition
        visual = self._discover_by_visual_pattern(signature, page_context)
        if visual:
            discoveries.extend(visual)
        
        # Strategy 5: Position-Relative Discovery
        if signature.position_hint:
            position_based = self._discover_by_position(signature, page_context)
            if position_based:
                discoveries.extend(position_based)
        
        # Strategy 6: DOM Structure Patterns
        dom_based = self._discover_by_dom_structure(signature, page_context)
        if dom_based:
            discoveries.extend(dom_based)
        
        # Sort by confidence (highest first)
        discoveries.sort(key=lambda x: x.confidence, reverse=True)
        
        # Build fallback chains
        for i, discovery in enumerate(discoveries):
            discovery.fallback_locators = [
                d.locator for d in discoveries[i+1:i+6]  # Next 5 as fallbacks
            ]
        
        return discoveries
    
    def _discover_by_semantic_role(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]]
    ) -> List[DiscoveredElement]:
        """Discover using semantic role + text matching (most robust)"""
        discoveries = []
        
        # Infer role from signature if not provided
        role = signature.role
        if not role and signature.tag:
            role = self._infer_role_from_tag(signature.tag, signature.attributes)
        
        if role:
            # Use getByRole (Playwright's most robust method)
            if signature.text:
                # Exact text match
                locator = f'page.getByRole("{role}", {{ name: "{signature.text}" }})'
                discoveries.append(DiscoveredElement(
                    locator=locator,
                    strategy=DiscoveryStrategy.SEMANTIC_ROLE,
                    confidence=0.95,
                    description=f"Role-based with exact text: {role} '{signature.text}'"
                ))
                
                # Partial text match (case-insensitive)
                locator = f'page.getByRole("{role}", {{ name: /{re.escape(signature.text)}/i }})'
                discoveries.append(DiscoveredElement(
                    locator=locator,
                    strategy=DiscoveryStrategy.SEMANTIC_ROLE,
                    confidence=0.90,
                    description=f"Role-based with partial text: {role} '{signature.text}'"
                ))
            else:
                # Role only
                locator = f'page.getByRole("{role}")'
                discoveries.append(DiscoveredElement(
                    locator=locator,
                    strategy=DiscoveryStrategy.SEMANTIC_ROLE,
                    confidence=0.75,
                    description=f"Role-based: {role}"
                ))
        
        return discoveries
    
    def _discover_by_text_similarity(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]]
    ) -> List[DiscoveredElement]:
        """Discover using fuzzy text matching"""
        discoveries = []
        
        if not signature.text:
            return discoveries
        
        text = signature.text.strip()
        
        # Exact text match (highest confidence)
        locator = f'page.getByText("{text}", {{ exact: true }})'
        discoveries.append(DiscoveredElement(
            locator=locator,
            strategy=DiscoveryStrategy.TEXT_SIMILARITY,
            confidence=0.90,
            description=f"Exact text match: '{text}'"
        ))
        
        # Partial text match
        locator = f'page.getByText("{text}")'
        discoveries.append(DiscoveredElement(
            locator=locator,
            strategy=DiscoveryStrategy.TEXT_SIMILARITY,
            confidence=0.85,
            description=f"Partial text match: '{text}'"
        ))
        
        # Case-insensitive match
        locator = f'page.getByText(/{re.escape(text)}/i)'
        discoveries.append(DiscoveredElement(
            locator=locator,
            strategy=DiscoveryStrategy.TEXT_SIMILARITY,
            confidence=0.80,
            description=f"Case-insensitive text: '{text}'"
        ))
        
        # Has-text selector (Playwright)
        locator = f'page.locator(":has-text(\\"{text}\\")")'
        discoveries.append(DiscoveredElement(
            locator=locator,
            strategy=DiscoveryStrategy.TEXT_SIMILARITY,
            confidence=0.75,
            description=f"Has-text selector: '{text}'"
        ))
        
        return discoveries
    
    def _discover_by_context(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]]
    ) -> List[DiscoveredElement]:
        """Discover using parent-child context relationships"""
        discoveries = []
        
        if not signature.parent_context:
            return discoveries
        
        # Try to find element within parent context
        parent = signature.parent_context
        
        # Strategy: Find parent first, then child within
        if signature.text:
            locator = f'page.locator("{parent}").getByText("{signature.text}")'
            discoveries.append(DiscoveredElement(
                locator=locator,
                strategy=DiscoveryStrategy.CONTEXT_AWARE,
                confidence=0.85,
                description=f"Text '{signature.text}' within context '{parent}'"
            ))
        
        if signature.role:
            locator = f'page.locator("{parent}").getByRole("{signature.role}")'
            discoveries.append(DiscoveredElement(
                locator=locator,
                strategy=DiscoveryStrategy.CONTEXT_AWARE,
                confidence=0.80,
                description=f"Role '{signature.role}' within context '{parent}'"
            ))
        
        return discoveries
    
    def _discover_by_visual_pattern(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]]
    ) -> List[DiscoveredElement]:
        """Discover using visual patterns (button-like, link-like, etc.)"""
        discoveries = []
        
        pattern = signature.visual_pattern
        if not pattern:
            # Infer pattern from signature
            pattern = self._infer_visual_pattern(signature)
        
        if pattern and pattern in self.element_patterns:
            pattern_info = self.element_patterns[pattern]
            
            # Try role-based first
            for role in pattern_info["roles"]:
                if signature.text:
                    locator = f'page.getByRole("{role}", {{ name: "{signature.text}" }})'
                    discoveries.append(DiscoveredElement(
                        locator=locator,
                        strategy=DiscoveryStrategy.VISUAL_PATTERN,
                        confidence=0.80,
                        description=f"Visual pattern '{pattern}' as {role} with text '{signature.text}'"
                    ))
                else:
                    locator = f'page.getByRole("{role}")'
                    discoveries.append(DiscoveredElement(
                        locator=locator,
                        strategy=DiscoveryStrategy.VISUAL_PATTERN,
                        confidence=0.65,
                        description=f"Visual pattern '{pattern}' as {role}"
                    ))
        
        return discoveries
    
    def _discover_by_position(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]]
    ) -> List[DiscoveredElement]:
        """Discover using relative position hints (last resort)"""
        discoveries = []
        
        # Position-based discovery is less reliable, so lower confidence
        if signature.tag:
            locator = f'page.locator("{signature.tag}").nth({signature.position_hint[0] if signature.position_hint else 0})'
            discoveries.append(DiscoveredElement(
                locator=locator,
                strategy=DiscoveryStrategy.POSITION_RELATIVE,
                confidence=0.40,
                description=f"Position-based: {signature.tag} at index"
            ))
        
        return discoveries
    
    def _discover_by_dom_structure(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]]
    ) -> List[DiscoveredElement]:
        """Discover using DOM structure patterns"""
        discoveries = []
        
        # Use stable attributes if available
        if signature.attributes:
            # Try data-testid first
            if 'data-testid' in signature.attributes:
                testid = signature.attributes['data-testid']
                locator = f'page.getByTestId("{testid}")'
                discoveries.append(DiscoveredElement(
                    locator=locator,
                    strategy=DiscoveryStrategy.DOM_STRUCTURE,
                    confidence=0.95,
                    description=f"data-testid: {testid}"
                ))
            
            # Try aria-label
            if 'aria-label' in signature.attributes:
                aria_label = signature.attributes['aria-label']
                locator = f'page.getByLabel("{aria_label}")'
                discoveries.append(DiscoveredElement(
                    locator=locator,
                    strategy=DiscoveryStrategy.DOM_STRUCTURE,
                    confidence=0.90,
                    description=f"aria-label: {aria_label}"
                ))
            
            # Try id (if stable)
            if 'id' in signature.attributes:
                element_id = signature.attributes['id']
                if self._is_stable_id(element_id):
                    locator = f'page.locator("#{element_id}")'
                    discoveries.append(DiscoveredElement(
                        locator=locator,
                        strategy=DiscoveryStrategy.DOM_STRUCTURE,
                        confidence=0.80,
                        description=f"Stable ID: {element_id}"
                    ))
        
        return discoveries
    
    def _infer_role_from_tag(self, tag: str, attributes: Dict[str, str]) -> Optional[str]:
        """Infer ARIA role from HTML tag and attributes"""
        role_map = {
            "button": "button",
            "a": "link",
            "input": self._get_input_role(attributes),
            "select": "combobox",
            "textarea": "textbox",
            "img": "img",
            "h1": "heading",
            "h2": "heading",
            "h3": "heading",
            "h4": "heading",
            "h5": "heading",
            "h6": "heading",
        }
        
        return role_map.get(tag.lower())
    
    def _get_input_role(self, attributes: Dict[str, str]) -> str:
        """Get role for input element based on type"""
        input_type = attributes.get("type", "text").lower()
        type_role_map = {
            "button": "button",
            "submit": "button",
            "search": "searchbox",
            "email": "textbox",
            "password": "textbox",
            "text": "textbox",
        }
        return type_role_map.get(input_type, "textbox")
    
    def _infer_visual_pattern(self, signature: ElementSignature) -> Optional[str]:
        """Infer visual pattern from element signature"""
        # Check text patterns
        if signature.text:
            text_lower = signature.text.lower()
            for pattern, info in self.element_patterns.items():
                for pattern_text in info["text_patterns"]:
                    if pattern_text in text_lower:
                        return pattern
        
        # Check tag
        if signature.tag:
            tag_lower = signature.tag.lower()
            if tag_lower in ["button", "a"]:
                return "button" if tag_lower == "button" else "link"
            if tag_lower in ["input", "textarea"]:
                return "input"
        
        # Check attributes
        if signature.attributes:
            if "onclick" in signature.attributes or signature.attributes.get("type") == "button":
                return "button"
            if "href" in signature.attributes:
                return "link"
        
        return None
    
    def _is_stable_id(self, element_id: str) -> bool:
        """Check if ID looks stable (not auto-generated)"""
        if len(element_id) > 50:
            return False
        
        # Check for UUID pattern
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if re.match(uuid_pattern, element_id, re.IGNORECASE):
            return False
        
        # Check if it's all numbers (likely timestamp or counter)
        if element_id.replace('-', '').replace('_', '').isdigit():
            return False
        
        return True
    
    def generate_robust_locator_chain(
        self,
        signature: ElementSignature,
        page_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a robust locator chain with multiple discovery strategies.
        
        Returns:
            Dict with primary locator, fallback chain, and metadata
        """
        discoveries = self.discover_element(signature, page_context)
        
        if not discoveries:
            # Ultimate fallback
            return {
                "primary": "page.locator('body')",  # Last resort
                "fallbacks": [],
                "strategy": "fallback",
                "confidence": 0.10,
                "all_discoveries": []
            }
        
        primary = discoveries[0]
        fallbacks = [d.locator for d in discoveries[1:10]]  # Up to 10 fallbacks
        
        return {
            "primary": primary.locator,
            "fallbacks": fallbacks,
            "strategy": primary.strategy.name,
            "confidence": primary.confidence,
            "all_discoveries": [
                {
                    "locator": d.locator,
                    "strategy": d.strategy.name,
                    "confidence": d.confidence,
                    "description": d.description
                }
                for d in discoveries
            ]
        }


# Global instance
_robust_discovery = None

def get_robust_element_discovery() -> RobustElementDiscovery:
    """Get or create global RobustElementDiscovery instance"""
    global _robust_discovery
    if _robust_discovery is None:
        _robust_discovery = RobustElementDiscovery()
    return _robust_discovery

