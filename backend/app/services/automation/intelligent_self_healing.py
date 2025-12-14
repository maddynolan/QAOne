"""
Intelligent Self-Healing Automation Engine
Enterprise-grade self-healing that adapts to UI changes automatically.
Works across all applications without per-app configuration.
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

from app.services.automation.robust_element_discovery import (
    RobustElementDiscovery,
    ElementSignature,
    get_robust_element_discovery
)

logger = logging.getLogger(__name__)


class HealingStrategy(Enum):
    """Self-healing strategies"""
    LOCATOR_FALLBACK = 1
    TEXT_SIMILARITY = 2
    ROLE_BASED = 3
    CONTEXT_NAVIGATION = 4
    VISUAL_MATCHING = 5
    POSITION_RELATIVE = 6
    DOM_PATTERN = 7
    FORCE_ACTION = 8


@dataclass
class ElementContext:
    """Context information about an element for intelligent matching"""
    original_selector: str
    element_text: Optional[str] = None
    element_role: Optional[str] = None
    element_tag: Optional[str] = None
    parent_selector: Optional[str] = None
    sibling_context: Optional[str] = None
    page_url: Optional[str] = None
    page_title: Optional[str] = None
    timestamp: Optional[datetime] = None
    
    def to_signature(self) -> ElementSignature:
        """Convert to ElementSignature for discovery"""
        attributes = {}
        if self.element_tag:
            attributes['tag'] = self.element_tag
        
        return ElementSignature(
            text=self.element_text,
            role=self.element_role,
            tag=self.element_tag,
            attributes=attributes,
            parent_context=self.parent_selector
        )


class IntelligentSelfHealing:
    """
    Intelligent self-healing engine that adapts to UI changes.
    
    Features:
    - Multi-strategy element discovery
    - Context-aware element matching
    - Automatic adaptation to UI changes
    - Learning from successful finds
    - Works across all applications
    """
    
    def __init__(self):
        self.discovery_engine = get_robust_element_discovery()
        self.healing_strategies = [
            self._heal_with_locator_fallback,
            self._heal_with_text_similarity,
            self._heal_with_role_based,
            self._heal_with_context_navigation,
            self._heal_with_visual_matching,
            self._heal_with_position_relative,
            self._heal_with_dom_pattern,
        ]
    
    def generate_self_healing_code(
        self,
        element_context: ElementContext,
        action: str = "click"
    ) -> str:
        """
        Generate self-healing Playwright code for an element.
        
        Args:
            element_context: Context about the element
            action: Action to perform (click, fill, select, etc.)
            
        Returns:
            Playwright code with intelligent self-healing
        """
        # Convert context to signature
        signature = element_context.to_signature()
        
        # Discover element using multiple strategies
        locator_chain = self.discovery_engine.generate_robust_locator_chain(
            signature,
            page_context={
                "url": element_context.page_url,
                "title": element_context.page_title
            }
        )
        
        # Generate self-healing code
        return self._build_healing_code(locator_chain, element_context, action)
    
    def _build_healing_code(
        self,
        locator_chain: Dict[str, Any],
        element_context: ElementContext,
        action: str
    ) -> str:
        """Build self-healing code with multiple strategies"""
        
        primary = locator_chain["primary"]
        fallbacks = locator_chain["fallbacks"]
        all_discoveries = locator_chain.get("all_discoveries", [])
        
        # Build comprehensive healing function
        code = f"""// Intelligent self-healing {action} function
async function {action}WithIntelligentHealing(page, elementContext) {{
  const strategies = [
    // Strategy 1: Primary locator
    async () => {{
      const element = {primary};
      await element.waitFor({{ state: 'visible', timeout: 5000 }});
      await element.{action}({{ timeout: 5000 }});
      return {{ success: true, strategy: 'primary', locator: `{primary}` }};
    }},
"""
        
        # Add fallback strategies
        for i, fallback in enumerate(fallbacks[:5]):  # Limit to 5 fallbacks
            code += f"""    // Strategy {i+2}: Fallback {i+1}
    async () => {{
      const element = {fallback};
      await element.waitFor({{ state: 'visible', timeout: 5000 }});
      await element.{action}({{ timeout: 5000 }});
      return {{ success: true, strategy: 'fallback_{i+1}', locator: `{fallback}` }};
    }},
"""
        
        # Add intelligent healing strategies
        code += """    // Strategy: Text similarity matching
    async () => {
      if (elementContext.text) {
        const element = page.getByText(elementContext.text, { exact: false });
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.click({ timeout: 5000 });
        return { success: true, strategy: 'text_similarity', locator: `text="${elementContext.text}"` };
      }
      throw new Error('No text available');
    },
    
    // Strategy: Role-based with text
    async () => {
      if (elementContext.role && elementContext.text) {
        const element = page.getByRole(elementContext.role, { name: elementContext.text });
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.click({ timeout: 5000 });
        return { success: true, strategy: 'role_based', locator: `role="${elementContext.role}" text="${elementContext.text}"` };
      }
      throw new Error('No role or text available');
    },
    
    // Strategy: Context-aware (parent-child)
    async () => {
      if (elementContext.parentSelector && elementContext.text) {
        const element = page.locator(elementContext.parentSelector).getByText(elementContext.text);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.click({ timeout: 5000 });
        return { success: true, strategy: 'context_aware', locator: `${elementContext.parentSelector} > text="${elementContext.text}"` };
      }
      throw new Error('No context available');
    },
    
    // Strategy: Force action (last resort)
    async () => {
      const element = page.locator(elementContext.originalSelector);
      await element.waitFor({ state: 'attached', timeout: 5000 });
      await element.click({ force: true, timeout: 5000 });
      return { success: true, strategy: 'force_action', locator: elementContext.originalSelector };
    },
  ];
  
  // Try each strategy in order
  let lastError = null;
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      console.log(`[SELF-HEAL] Success with strategy: ${result.strategy}`);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`[SELF-HEAL] Strategy failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All healing strategies failed. Last error: ${lastError?.message}`);
}}"""
        
        return code
    
    def _heal_with_locator_fallback(self, page, element_context: ElementContext) -> Optional[Any]:
        """Heal using locator fallback chain"""
        # This is handled in the generated code
        return None
    
    def _heal_with_text_similarity(self, page, element_context: ElementContext) -> Optional[Any]:
        """Heal using text similarity matching"""
        if not element_context.element_text:
            return None
        
        # Try exact match first
        try:
            element = page.getByText(element_context.element_text, exact=True)
            if element.is_visible():
                return element
        except:
            pass
        
        # Try partial match
        try:
            element = page.getByText(element_context.element_text)
            if element.is_visible():
                return element
        except:
            pass
        
        return None
    
    def _heal_with_role_based(self, page, element_context: ElementContext) -> Optional[Any]:
        """Heal using role-based matching"""
        if not element_context.element_role:
            return None
        
        try:
            if element_context.element_text:
                element = page.getByRole(element_context.element_role, name=element_context.element_text)
            else:
                element = page.getByRole(element_context.element_role)
            
            if element.is_visible():
                return element
        except:
            pass
        
        return None
    
    def _heal_with_context_navigation(self, page, element_context: ElementContext) -> Optional[Any]:
        """Heal using parent-child context"""
        if not element_context.parent_selector or not element_context.element_text:
            return None
        
        try:
            parent = page.locator(element_context.parent_selector)
            element = parent.getByText(element_context.element_text)
            if element.is_visible():
                return element
        except:
            pass
        
        return None
    
    def _heal_with_visual_matching(self, page, element_context: ElementContext) -> Optional[Any]:
        """Heal using visual pattern matching"""
        # Infer visual pattern and try role-based
        if element_context.element_tag in ['button', 'a']:
            role = 'button' if element_context.element_tag == 'button' else 'link'
            try:
                element = page.getByRole(role)
                if element.is_visible():
                    return element
            except:
                pass
        
        return None
    
    def _heal_with_position_relative(self, page, element_context: ElementContext) -> Optional[Any]:
        """Heal using relative position (last resort)"""
        if not element_context.element_tag:
            return None
        
        try:
            # Try first element of this tag type
            element = page.locator(element_context.element_tag).first()
            if element.is_visible():
                return element
        except:
            pass
        
        return None
    
    def _heal_with_dom_pattern(self, page, element_context: ElementContext) -> Optional[Any]:
        """Heal using DOM structure patterns"""
        # Try to find by stable attributes
        if element_context.original_selector:
            # Extract potential stable attributes
            if 'data-testid' in element_context.original_selector:
                match = re.search(r'data-testid=["\']([^"\']+)["\']', element_context.original_selector)
                if match:
                    try:
                        element = page.getByTestId(match.group(1))
                        if element.is_visible():
                            return element
                    except:
                        pass
        
        return None


# Global instance
_intelligent_healing = None

def get_intelligent_self_healing() -> IntelligentSelfHealing:
    """Get or create global IntelligentSelfHealing instance"""
    global _intelligent_healing
    if _intelligent_healing is None:
        _intelligent_healing = IntelligentSelfHealing()
    return _intelligent_healing







