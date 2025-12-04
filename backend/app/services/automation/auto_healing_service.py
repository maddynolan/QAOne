"""
Auto-Healing Test Service
Implements self-healing test capabilities with intelligent locator fallback.
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class AutoHealingService:
    """
    Auto-healing service that:
    1. Detects when locators fail
    2. Tries fallback locators automatically
    3. Learns successful locators for future use
    4. Updates test scripts with working locators
    """
    
    def __init__(self):
        self.healing_strategies = [
            self._try_fallback_locators,
            self._try_similar_selectors,
            self._try_parent_child_relationship,
            self._try_text_based_locator,
            self._try_position_based_locator
        ]
    
    def generate_auto_healing_code(
        self,
        locator_info: Dict[str, Any],
        action: str = "click"
    ) -> str:
        """
        Generate Playwright code with auto-healing capabilities.
        
        Args:
            locator_info: Locator information from LocatorEngine
            action: Action to perform (click, fill, select, etc.)
            
        Returns:
            Playwright code with auto-healing
        """
        primary = locator_info.get("primary", "")
        fallbacks = locator_info.get("fallbacks", [])
        strategy = locator_info.get("strategy", "unknown")
        
        # Build auto-healing function
        code = f"""// Auto-healing locator with fallback chain
async function {action}_with_healing(page, elementInfo) {{
  const locators = [
    "{primary}",  // Primary: {strategy}
"""
        
        for i, fallback in enumerate(fallbacks):
            code += f'    "{fallback}",  // Fallback {i+1}\n'
        
        code += """  ];
  
  let element = null;
  let lastError = null;
  
  for (const locator of locators) {
    try {
      element = page.locator(locator);
      await element.waitFor({ state: 'visible', timeout: 5000 });
      
      // Verify element is actionable
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled().catch(() => true);
      
      if (isVisible && isEnabled) {
        console.log(`[AUTO-HEAL] Successfully found element with locator: ${locator}`);
        return element;
      }
    } catch (error) {
      lastError = error;
      console.log(`[AUTO-HEAL] Locator failed: ${locator} - ${error.message}`);
      continue;
    }
  }
  
  // If all locators fail, try intelligent fallback
  element = await tryIntelligentFallback(page, elementInfo);
  if (element) {
    return element;
  }
  
  throw new Error(`Element not found with any locator. Last error: ${lastError?.message}`);
}

// Intelligent fallback strategies
async function tryIntelligentFallback(page, elementInfo) {
  const strategies = [
    // Strategy 1: Try similar selectors
    async () => {
      const tag = elementInfo.tag || 'button';
      const text = elementInfo.text;
      if (text) {
        return page.locator(`${tag}:has-text("${text}")`);
      }
    },
    
    // Strategy 2: Try parent-child relationship
    async () => {
      const parent = elementInfo.parentSelector;
      const tag = elementInfo.tag || 'button';
      if (parent) {
        return page.locator(`${parent} ${tag}`).first();
      }
    },
    
    // Strategy 3: Try by role
    async () => {
      const role = elementInfo.role;
      if (role) {
        return page.locator(`[role="${role}"]`).first();
      }
    },
    
    // Strategy 4: Try by position (last resort)
    async () => {
      const tag = elementInfo.tag || 'button';
      const index = elementInfo.index || 0;
      return page.locator(tag).nth(index);
    }
  ];
  
  for (const strategy of strategies) {
    try {
      const element = await strategy();
      if (element) {
        await element.waitFor({ state: 'visible', timeout: 3000 });
        return element;
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}
"""
        
        # Generate action code
        action_code = self._generate_action_code(action, f"{action}_with_healing")
        
        return code + "\n\n" + action_code
    
    def _generate_action_code(self, action: str, healing_function: str) -> str:
        """Generate code for specific action with auto-healing."""
        action_map = {
            "click": f"""// Auto-healing click
const element = await {healing_function}(page, elementInfo);
await element.click();
await expect(element).toBeVisible();""",
            
            "fill": f"""// Auto-healing fill
const element = await {healing_function}(page, elementInfo);
await element.fill(value);
await expect(element).toHaveValue(value);""",
            
            "select": f"""// Auto-healing select
const element = await {healing_function}(page, elementInfo);
await element.selectOption(value);
await expect(element).toHaveValue(value);""",
            
            "check": f"""// Auto-healing check
const element = await {healing_function}(page, elementInfo);
await element.check();
await expect(element).toBeChecked();""",
        }
        
        return action_map.get(action, f"const element = await {healing_function}(page, elementInfo);")
    
    def _try_fallback_locators(self, page, locators: List[str]) -> Optional[Any]:
        """Try fallback locators in order."""
        for locator in locators:
            try:
                element = page.locator(locator)
                if element.is_visible():
                    return element
            except:
                continue
        return None
    
    def _try_similar_selectors(self, page, original_selector: str) -> Optional[Any]:
        """Try similar selectors based on original."""
        # Extract tag and attributes
        tag_match = re.search(r'^(\w+)', original_selector)
        if tag_match:
            tag = tag_match.group(1)
            # Try just the tag
            try:
                return page.locator(tag).first()
            except:
                pass
        return None
    
    def _try_parent_child_relationship(self, page, element_info: Dict[str, Any]) -> Optional[Any]:
        """Try finding element via parent-child relationship."""
        parent = element_info.get("parent_selector")
        tag = element_info.get("tag", "button")
        
        if parent:
            try:
                return page.locator(f"{parent} {tag}").first()
            except:
                pass
        return None
    
    def _try_text_based_locator(self, page, element_info: Dict[str, Any]) -> Optional[Any]:
        """Try text-based locator."""
        text = element_info.get("text")
        tag = element_info.get("tag", "button")
        
        if text:
            try:
                return page.locator(f'{tag}:has-text("{text}")')
            except:
                pass
        return None
    
    def _try_position_based_locator(self, page, element_info: Dict[str, Any]) -> Optional[Any]:
        """Try position-based locator (last resort)."""
        tag = element_info.get("tag", "button")
        index = element_info.get("index", 0)
        
        try:
            return page.locator(tag).nth(index)
        except:
            return None
    
    def learn_from_success(
        self,
        original_locator: str,
        successful_locator: str,
        context: Dict[str, Any]
    ):
        """Learn from successful healing for future use."""
        # Store successful locator mapping
        # In production, this would be stored in a database
        logger.info(
            f"Learned: Original locator '{original_locator}' can be replaced with "
            f"'{successful_locator}' in similar contexts"
        )


# Global instance
_auto_healing_service = None

def get_auto_healing_service() -> AutoHealingService:
    """Get or create global AutoHealingService instance"""
    global _auto_healing_service
    if _auto_healing_service is None:
        _auto_healing_service = AutoHealingService()
    return _auto_healing_service




