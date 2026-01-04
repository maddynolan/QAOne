"""
AI Vision Self-Healing Service

Provides GPT-4 Vision powered element detection and reactive self-healing.
This is ADDITIVE - does not modify existing fallback strategies.

Usage:
    from app.services.ai.vision_self_healing import VisionSelfHealingService
    
    service = VisionSelfHealingService()
    
    # Find element using AI vision
    result = await service.find_element_by_description(
        screenshot_base64="...",
        description="the blue Submit button at bottom right"
    )
    
    # Reactive self-healing: fix a broken selector
    fixed = await service.heal_broken_selector(
        screenshot_base64="...",
        original_selector="#old-button-id",
        element_description="Submit button",
        page_html="<html>..."
    )
"""

import logging
import base64
import json
import os
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Check for OpenAI availability
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI not available. Install with: pip install openai")


@dataclass
class ElementLocation:
    """Result of AI element detection"""
    found: bool
    x: Optional[int] = None
    y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    confidence: float = 0.0
    selector_suggestion: Optional[str] = None
    description: Optional[str] = None
    error: Optional[str] = None


@dataclass
class HealingResult:
    """Result of self-healing attempt"""
    success: bool
    original_selector: str
    healed_selector: Optional[str] = None
    healing_method: Optional[str] = None  # 'ai_vision', 'dom_analysis', 'fallback_chain'
    confidence: float = 0.0
    explanation: Optional[str] = None
    error: Optional[str] = None


class VisionSelfHealingService:
    """
    AI-powered self-healing using GPT-4 Vision.
    
    This service provides:
    1. Element detection from screenshots using natural language
    2. Reactive self-healing when selectors break
    3. Selector suggestions based on visual analysis
    
    IMPORTANT: This is designed to COMPLEMENT existing fallback strategies,
    not replace them. Use this as a last resort or for complex cases.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Vision Self-Healing Service.
        
        Args:
            api_key: OpenAI API key. If not provided, uses OPENAI_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client = None
        self.available = False
        
        if OPENAI_AVAILABLE and self.api_key:
            try:
                self.client = AsyncOpenAI(api_key=self.api_key)
                self.available = True
                logger.info("VisionSelfHealingService initialized with GPT-4 Vision")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
        else:
            if not OPENAI_AVAILABLE:
                logger.warning("OpenAI library not installed")
            elif not self.api_key:
                logger.warning("OPENAI_API_KEY not set")
    
    def set_api_key(self, api_key: str) -> bool:
        """
        Update the API key and reinitialize the client.
        
        Args:
            api_key: New OpenAI API key
            
        Returns:
            True if client was successfully reinitialized
        """
        self.api_key = api_key
        self.available = False
        
        if OPENAI_AVAILABLE and api_key:
            try:
                self.client = AsyncOpenAI(api_key=api_key)
                self.available = True
                logger.info("VisionSelfHealingService reinitialized with new API key")
                return True
            except Exception as e:
                logger.error(f"Failed to reinitialize OpenAI client: {e}")
                return False
        return False
    
    async def find_element_by_description(
        self,
        screenshot_base64: str,
        description: str,
        context: Optional[str] = None
    ) -> ElementLocation:
        """
        Find an element in a screenshot using natural language description.
        
        Args:
            screenshot_base64: Base64-encoded screenshot image
            description: Natural language description of the element
                         e.g., "the blue Submit button at bottom right"
            context: Optional context about the page/application
        
        Returns:
            ElementLocation with coordinates and confidence
        """
        if not self.available:
            return ElementLocation(
                found=False,
                error="GPT-4 Vision not available. Set OPENAI_API_KEY environment variable."
            )
        
        try:
            # Prepare the image for GPT-4 Vision
            # Handle both raw base64 and data URL formats
            if screenshot_base64.startswith('data:'):
                image_url = screenshot_base64
            else:
                image_url = f"data:image/png;base64,{screenshot_base64}"
            
            # Build the prompt
            system_prompt = """You are an expert UI element detector. 
Analyze the screenshot and find the element described by the user.
Return a JSON object with:
{
    "found": true/false,
    "x": center X coordinate (integer),
    "y": center Y coordinate (integer),
    "width": approximate width in pixels,
    "height": approximate height in pixels,
    "confidence": 0.0-1.0 how confident you are,
    "selector_suggestion": "suggested CSS selector if visible",
    "description": "what you see at that location"
}
If the element is not found, set found=false and explain in description."""
            
            user_prompt = f"Find this element: {description}"
            if context:
                user_prompt += f"\n\nPage context: {context}"
            
            # Call GPT-4 Vision
            response = await self.client.chat.completions.create(
                model="gpt-4o",  # or "gpt-4-vision-preview"
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url, "detail": "high"}
                            }
                        ]
                    }
                ],
                max_tokens=500,
                temperature=0.1  # Low temperature for consistent results
            )
            
            # Parse the response
            result_text = response.choices[0].message.content
            
            # Extract JSON from response (handle markdown code blocks)
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            result_json = json.loads(result_text.strip())
            
            return ElementLocation(
                found=result_json.get("found", False),
                x=result_json.get("x"),
                y=result_json.get("y"),
                width=result_json.get("width"),
                height=result_json.get("height"),
                confidence=result_json.get("confidence", 0.0),
                selector_suggestion=result_json.get("selector_suggestion"),
                description=result_json.get("description")
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse GPT-4 Vision response: {e}")
            return ElementLocation(found=False, error=f"Failed to parse AI response: {e}")
        except Exception as e:
            logger.error(f"GPT-4 Vision error: {e}", exc_info=True)
            return ElementLocation(found=False, error=str(e))
    
    async def heal_broken_selector(
        self,
        screenshot_base64: str,
        original_selector: str,
        element_description: str,
        page_html: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> HealingResult:
        """
        Attempt to heal a broken selector using AI analysis.
        
        This is the REACTIVE self-healing feature - called when a test fails.
        
        Args:
            screenshot_base64: Current screenshot where selector failed
            original_selector: The selector that failed
            element_description: What the element should be (from test step)
            page_html: Optional current page HTML for DOM analysis
            error_message: The error that occurred
        
        Returns:
            HealingResult with new selector suggestion
        """
        if not self.available:
            return HealingResult(
                success=False,
                original_selector=original_selector,
                error="GPT-4 Vision not available"
            )
        
        try:
            # Prepare image
            if screenshot_base64.startswith('data:'):
                image_url = screenshot_base64
            else:
                image_url = f"data:image/png;base64,{screenshot_base64}"
            
            # Build healing prompt
            system_prompt = """You are an expert test automation engineer specializing in self-healing tests.
A test failed because a selector no longer works. Analyze the screenshot and suggest a fix.

Return a JSON object:
{
    "success": true/false,
    "healed_selector": "new CSS or XPath selector",
    "healing_method": "visual_match" | "text_match" | "structure_match",
    "confidence": 0.0-1.0,
    "explanation": "why this selector should work"
}

Prioritize selectors in this order:
1. data-testid attributes (most stable)
2. aria-label or role attributes
3. Unique text content
4. Structural path (as last resort)"""
            
            user_content = f"""The selector "{original_selector}" failed.
Element description: {element_description}
Error: {error_message or 'Element not found'}

Analyze the screenshot and find the element. Suggest a new, more robust selector."""
            
            # Add DOM context if available (truncated to avoid token limits)
            if page_html:
                # Extract relevant portion of HTML (around likely element location)
                truncated_html = page_html[:5000] if len(page_html) > 5000 else page_html
                user_content += f"\n\nPartial page HTML:\n```html\n{truncated_html}\n```"
            
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_content},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url, "detail": "high"}
                            }
                        ]
                    }
                ],
                max_tokens=500,
                temperature=0.1
            )
            
            result_text = response.choices[0].message.content
            
            # Parse JSON response
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            result_json = json.loads(result_text.strip())
            
            return HealingResult(
                success=result_json.get("success", False),
                original_selector=original_selector,
                healed_selector=result_json.get("healed_selector"),
                healing_method=f"ai_vision_{result_json.get('healing_method', 'unknown')}",
                confidence=result_json.get("confidence", 0.0),
                explanation=result_json.get("explanation")
            )
            
        except Exception as e:
            logger.error(f"Self-healing error: {e}", exc_info=True)
            return HealingResult(
                success=False,
                original_selector=original_selector,
                error=str(e)
            )
    
    async def suggest_better_selectors(
        self,
        screenshot_base64: str,
        current_selector: str,
        page_html: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Proactively suggest more robust selectors for an element.
        
        Use this during test creation to get better selectors upfront.
        
        Args:
            screenshot_base64: Screenshot showing the element
            current_selector: The selector currently being used
            page_html: Optional page HTML
        
        Returns:
            List of selector suggestions with confidence scores
        """
        if not self.available:
            return []
        
        try:
            if screenshot_base64.startswith('data:'):
                image_url = screenshot_base64
            else:
                image_url = f"data:image/png;base64,{screenshot_base64}"
            
            prompt = f"""Analyze the element selected by "{current_selector}" and suggest 3-5 alternative selectors
ordered from most to least robust.

Return JSON array:
[
    {{"selector": "...", "type": "data-testid|aria|text|xpath", "confidence": 0.9, "reason": "..."}},
    ...
]"""
            
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": image_url}}
                        ]
                    }
                ],
                max_tokens=500,
                temperature=0.2
            )
            
            result_text = response.choices[0].message.content
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            return json.loads(result_text.strip())
            
        except Exception as e:
            logger.error(f"Selector suggestion error: {e}")
            return []


# Singleton instance for easy import
_service_instance: Optional[VisionSelfHealingService] = None

def get_vision_healing_service() -> VisionSelfHealingService:
    """Get or create the singleton service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = VisionSelfHealingService()
    return _service_instance

