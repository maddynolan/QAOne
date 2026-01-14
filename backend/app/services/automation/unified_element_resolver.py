"""
Unified Element Resolver with AI Fallback
==========================================

This is the CORE component for achieving ZERO playback failures.

Resolution Order:
1. Primary selector (from recording)
2. Recipe-based resolution (role, text, label)
3. Auto-healing fallback chain (9 strategies)
4. AI Vision fallback (LAST RESORT - GPT-4o-mini)

AI is ONLY called when ALL deterministic methods fail.
Budget: Maximum 3 AI calls per test run.
"""

import logging
import base64
import json
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class ResolutionMethod(str, Enum):
    """How the element was resolved"""
    PRIMARY = "primary"          # Original selector worked
    RECIPE = "recipe"            # Recipe-based (role/text/label)
    AUTO_HEAL = "auto_heal"      # Fallback chain
    AI_VISION = "ai_vision"      # AI last resort
    FAILED = "failed"            # Could not resolve


@dataclass
class ResolutionResult:
    """Result of element resolution"""
    success: bool
    method: ResolutionMethod
    selector_used: str
    confidence: float = 1.0
    ai_called: bool = False
    attempts: List[str] = field(default_factory=list)
    error: Optional[str] = None
    healing_logged: bool = False


@dataclass 
class AIUsageBudget:
    """
    Budget control for AI calls per test run.
    Prevents runaway costs.
    """
    max_calls_per_run: int = 3
    calls_used: int = 0
    
    def can_use(self) -> bool:
        return self.calls_used < self.max_calls_per_run
    
    def use(self):
        self.calls_used += 1
        
    def remaining(self) -> int:
        return max(0, self.max_calls_per_run - self.calls_used)
    
    def reset(self):
        self.calls_used = 0


class UnifiedElementResolver:
    """
    Unified element resolution with AI fallback.
    
    This class ensures ZERO element identification failures by:
    1. Trying all deterministic strategies first (FREE, FAST)
    2. Using AI Vision only as absolute last resort (COST CONTROLLED)
    3. Caching healed selectors for future use
    4. Logging all healing events for review
    """
    
    def __init__(
        self,
        page,
        enable_ai: bool = True,
        ai_budget: Optional[AIUsageBudget] = None,
        app_type: str = "generic"
    ):
        """
        Initialize the resolver.
        
        Args:
            page: Playwright page object
            enable_ai: Whether to use AI fallback (default True)
            ai_budget: Budget control for AI calls
            app_type: Application type for app-specific strategies
        """
        self.page = page
        self.enable_ai = enable_ai
        self.ai_budget = ai_budget or AIUsageBudget()
        self.app_type = app_type
        self.healing_cache: Dict[str, str] = {}
        self.healing_log: List[Dict[str, Any]] = []
        
        # Initialize AI service lazily
        self._ai_service = None
    
    @property
    def ai_service(self):
        """Lazy load AI service to avoid import overhead when not needed."""
        if self._ai_service is None:
            try:
                from app.services.ai.vision_self_healing import get_vision_healing_service
                self._ai_service = get_vision_healing_service()
            except ImportError:
                logger.warning("Vision self-healing service not available")
                self._ai_service = None
        return self._ai_service
    
    async def resolve_element(
        self,
        step: Dict[str, Any],
        timeout: int = 10000
    ) -> ResolutionResult:
        """
        Resolve an element using the layered approach.
        
        Args:
            step: Test step with selector info
            timeout: Maximum time to wait for element
            
        Returns:
            ResolutionResult with resolution details
        """
        attempts = []
        
        # Extract element info from step
        primary_selector = self._get_primary_selector(step)
        element_description = self._get_element_description(step)
        recipe = step.get('recipe', {})
        fallback_selectors = step.get('fallbacks', []) or step.get('selectorObj', {}).get('strategies', [])
        
        # ============================================
        # LAYER 1: Primary Selector
        # ============================================
        if primary_selector:
            attempts.append(f"Primary: {primary_selector}")
            try:
                locator = self.page.locator(primary_selector)
                if await locator.count() > 0:
                    element = locator.first
                    if await element.is_visible(timeout=2000):
                        return ResolutionResult(
                            success=True,
                            method=ResolutionMethod.PRIMARY,
                            selector_used=primary_selector,
                            confidence=1.0,
                            attempts=attempts
                        )
            except Exception as e:
                logger.debug(f"Primary selector failed: {e}")
        
        # ============================================
        # LAYER 2: Recipe-Based Resolution
        # ============================================
        recipe_selectors = self._generate_recipe_selectors(recipe, step)
        for selector_info in recipe_selectors:
            selector = selector_info['selector']
            selector_type = selector_info['type']
            attempts.append(f"Recipe ({selector_type}): {selector}")
            
            try:
                locator = self.page.locator(selector)
                if await locator.count() > 0:
                    element = locator.first
                    if await element.is_visible(timeout=2000):
                        # Log healing if not primary
                        self._log_healing(primary_selector, selector, 'recipe', selector_type)
                        return ResolutionResult(
                            success=True,
                            method=ResolutionMethod.RECIPE,
                            selector_used=selector,
                            confidence=0.95,
                            attempts=attempts,
                            healing_logged=True
                        )
            except Exception as e:
                logger.debug(f"Recipe selector failed ({selector_type}): {e}")
        
        # ============================================
        # LAYER 3: Auto-Healing Fallback Chain
        # ============================================
        for fallback in fallback_selectors:
            selector = fallback if isinstance(fallback, str) else fallback.get('selector', fallback.get('playwrightCode', ''))
            if not selector or selector == primary_selector:
                continue
                
            attempts.append(f"Fallback: {selector}")
            
            try:
                locator = self.page.locator(selector)
                if await locator.count() > 0:
                    element = locator.first
                    if await element.is_visible(timeout=2000):
                        self._log_healing(primary_selector, selector, 'auto_heal')
                        return ResolutionResult(
                            success=True,
                            method=ResolutionMethod.AUTO_HEAL,
                            selector_used=selector,
                            confidence=0.85,
                            attempts=attempts,
                            healing_logged=True
                        )
            except Exception as e:
                logger.debug(f"Fallback selector failed: {e}")
        
        # ============================================
        # LAYER 4: AI Vision Fallback (LAST RESORT)
        # ============================================
        if self.enable_ai and self.ai_budget.can_use() and self.ai_service:
            attempts.append("AI Vision (last resort)")
            
            try:
                # Take screenshot
                screenshot_bytes = await self.page.screenshot(type='png')
                screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                
                # Get DOM context
                dom_content = await self.page.content()
                dom_snippet = dom_content[:5000]  # Truncate for API
                
                # Use AI budget
                self.ai_budget.use()
                logger.info(f"🤖 AI Vision called (budget: {self.ai_budget.remaining()} remaining)")
                
                # Call AI service
                result = await self.ai_service.find_element_by_description(
                    screenshot_base64=screenshot_b64,
                    description=element_description,
                    context=f"App type: {self.app_type}, URL: {self.page.url}"
                )
                
                if result.found and result.confidence > 0.7:
                    # AI found the element - try to click by coordinates
                    if result.x and result.y:
                        # Validate by clicking at coordinates
                        ai_selector = f"page.click({{ x: {result.x}, y: {result.y} }})"
                        
                        # If AI suggests a selector, try it
                        if result.selector_suggestion:
                            try:
                                locator = self.page.locator(result.selector_suggestion)
                                if await locator.count() > 0 and await locator.first.is_visible(timeout=2000):
                                    self._log_healing(primary_selector, result.selector_suggestion, 'ai_vision')
                                    # Cache for future
                                    self.healing_cache[primary_selector] = result.selector_suggestion
                                    
                                    return ResolutionResult(
                                        success=True,
                                        method=ResolutionMethod.AI_VISION,
                                        selector_used=result.selector_suggestion,
                                        confidence=result.confidence,
                                        ai_called=True,
                                        attempts=attempts,
                                        healing_logged=True
                                    )
                            except Exception:
                                pass
                        
                        # Fallback: Return coordinates for click
                        self._log_healing(primary_selector, f"coordinates({result.x},{result.y})", 'ai_vision')
                        return ResolutionResult(
                            success=True,
                            method=ResolutionMethod.AI_VISION,
                            selector_used=f"coordinates:{result.x},{result.y}",
                            confidence=result.confidence,
                            ai_called=True,
                            attempts=attempts,
                            healing_logged=True
                        )
                        
            except Exception as e:
                logger.error(f"AI Vision fallback failed: {e}")
                attempts.append(f"AI error: {str(e)}")
        
        # ============================================
        # COMPLETE FAILURE
        # ============================================
        return ResolutionResult(
            success=False,
            method=ResolutionMethod.FAILED,
            selector_used="",
            confidence=0.0,
            ai_called=self.ai_budget.calls_used > 0,
            attempts=attempts,
            error=f"Could not find element: {element_description}. Tried {len(attempts)} strategies."
        )
    
    def _get_primary_selector(self, step: Dict[str, Any]) -> Optional[str]:
        """Extract primary selector from step."""
        # Try different possible locations
        if step.get('selector'):
            return step['selector']
        if step.get('selectorObj', {}).get('selector'):
            return step['selectorObj']['selector']
        if step.get('element', {}).get('selectors'):
            selectors = step['element']['selectors']
            if selectors and len(selectors) > 0:
                first = selectors[0]
                return first.get('selector', first.get('playwright', ''))
        return None
    
    def _get_element_description(self, step: Dict[str, Any]) -> str:
        """Get human-readable element description."""
        # Priority: description > text > label > selector
        if step.get('description'):
            return step['description']
        if step.get('text'):
            return f"'{step['text']}'"
        if step.get('label'):
            return f"labeled '{step['label']}'"
        if step.get('element', {}).get('text'):
            return f"'{step['element']['text']}'"
        if step.get('element', {}).get('ariaLabel'):
            return step['element']['ariaLabel']
        
        # Fall back to action + selector
        action = step.get('action', step.get('type', 'click'))
        selector = self._get_primary_selector(step) or 'element'
        return f"{action} on {selector}"
    
    def _generate_recipe_selectors(
        self, 
        recipe: Dict[str, Any],
        step: Dict[str, Any]
    ) -> List[Dict[str, str]]:
        """
        Generate Playwright selectors from recipe.
        
        Recipe format:
        {
            "what": {"role": "button", "text": "Submit"},
            "where": {"landmark": "form", "nearText": "Email"},
            "which": {"testId": "submit", "position": 1}
        }
        """
        selectors = []
        
        what = recipe.get('what', {})
        where = recipe.get('where', {})
        which = recipe.get('which', {})
        
        # Also check step for element info
        element = step.get('element', {})
        
        # 1. TestID (highest priority)
        test_id = which.get('testId') or element.get('testId') or element.get('data-testid')
        if test_id:
            selectors.append({
                'type': 'testId',
                'selector': f"[data-testid='{test_id}']"
            })
        
        # 2. Role + Name (Playwright's recommended)
        role = what.get('role') or element.get('role')
        text = what.get('text') or element.get('text') or step.get('text')
        
        if role and text:
            # Clean text for selector
            clean_text = text.replace("'", "\\'")
            selectors.append({
                'type': 'role+name',
                'selector': f"role={role}[name='{clean_text}']"
            })
        
        # 3. Role only
        if role:
            selectors.append({
                'type': 'role',
                'selector': f"role={role}"
            })
        
        # 4. Text-based
        if text:
            clean_text = text.replace("'", "\\'")
            selectors.append({
                'type': 'text',
                'selector': f"text='{clean_text}'"
            })
            # Also try exact match
            selectors.append({
                'type': 'text-exact',
                'selector': f"text='{clean_text}' >> visible=true"
            })
        
        # 5. Label-based (for form inputs)
        label = where.get('nearText') or element.get('label') or step.get('label')
        if label:
            clean_label = label.replace("'", "\\'")
            selectors.append({
                'type': 'label',
                'selector': f"label:has-text('{clean_label}') >> input, label:has-text('{clean_label}') >> textarea"
            })
        
        # 6. ARIA label
        aria_label = which.get('ariaLabel') or element.get('ariaLabel')
        if aria_label:
            selectors.append({
                'type': 'aria-label',
                'selector': f"[aria-label='{aria_label}']"
            })
        
        # 7. Placeholder
        placeholder = which.get('placeholder') or element.get('placeholder')
        if placeholder:
            selectors.append({
                'type': 'placeholder',
                'selector': f"[placeholder='{placeholder}']"
            })
        
        # 8. Name attribute
        name = which.get('name') or element.get('name')
        if name:
            selectors.append({
                'type': 'name',
                'selector': f"[name='{name}']"
            })
        
        # 9. ID (non-dynamic)
        elem_id = which.get('id') or element.get('id')
        if elem_id and not self._is_dynamic_id(elem_id):
            selectors.append({
                'type': 'id',
                'selector': f"#{elem_id}"
            })
        
        return selectors
    
    def _is_dynamic_id(self, id_value: str) -> bool:
        """Check if an ID looks dynamic (should be avoided)."""
        import re
        dynamic_patterns = [
            r'^[a-f0-9]{8}-[a-f0-9]{4}-',  # UUID
            r'^\d+$',                        # Pure numbers
            r'_\d+$',                        # Ending with numbers
            r'^ember\d+',                    # Ember.js
            r'^react-',                      # React
            r'^:r\d+:',                      # Radix
            r'^aura\d+',                     # Salesforce Aura
            r'^lwc-\d+',                     # Salesforce LWC
        ]
        return any(re.match(p, id_value, re.IGNORECASE) for p in dynamic_patterns)
    
    def _log_healing(
        self, 
        original: Optional[str], 
        healed: str, 
        method: str,
        strategy: str = ""
    ):
        """Log healing event for review."""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'original_selector': original,
            'healed_selector': healed,
            'method': method,
            'strategy': strategy,
            'app_type': self.app_type,
            'page_url': self.page.url if self.page else None
        }
        self.healing_log.append(entry)
        logger.info(f"🔧 Element healed: {method} ({strategy or 'N/A'})")
        logger.debug(f"   Original: {original}")
        logger.debug(f"   Healed: {healed}")
    
    def get_healing_report(self) -> Dict[str, Any]:
        """Get summary of healing events for this run."""
        return {
            'total_healings': len(self.healing_log),
            'ai_calls_used': self.ai_budget.calls_used,
            'ai_calls_remaining': self.ai_budget.remaining(),
            'methods_used': [h['method'] for h in self.healing_log],
            'details': self.healing_log
        }
    
    def reset_budget(self):
        """Reset AI budget for new test run."""
        self.ai_budget.reset()
        self.healing_log = []


# Convenience function for quick resolution
async def resolve_with_ai_fallback(
    page,
    step: Dict[str, Any],
    enable_ai: bool = True,
    app_type: str = "generic"
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Quick helper to resolve an element with AI fallback.
    
    Returns:
        Tuple of (success, selector_or_coordinates, resolution_info)
    """
    resolver = UnifiedElementResolver(
        page=page,
        enable_ai=enable_ai,
        app_type=app_type
    )
    
    result = await resolver.resolve_element(step)
    
    return (
        result.success,
        result.selector_used,
        {
            'method': result.method.value,
            'confidence': result.confidence,
            'ai_called': result.ai_called,
            'attempts': result.attempts,
            'error': result.error
        }
    )
