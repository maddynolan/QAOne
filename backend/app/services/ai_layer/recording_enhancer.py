"""
Recording Enhancer - AI-Powered Test Case Enhancement
Uses GPT-4o-mini to enhance recorded actions into professional test cases.
"""

import logging
import json
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class RecordingEnhancer:
    """
    Enhances recorded browser actions using GPT-4o-mini.
    
    Features:
    - Converts raw actions to readable test steps
    - Generates meaningful test names
    - Adds smart assertions based on context
    - Suggests edge cases and additional tests
    """
    
    def __init__(self):
        self._openai_service = None
    
    def _get_openai_service(self):
        """Lazy load OpenAI service"""
        if self._openai_service is None:
            from app.services.llm.openai_service import OpenAIService
            self._openai_service = OpenAIService()
        return self._openai_service
    
    async def enhance_recording(
        self,
        actions: List[Dict[str, Any]],
        metadata: Dict[str, Any] = None,
        enhancement_level: str = "standard"
    ) -> Dict[str, Any]:
        """
        Enhance a recording with AI-generated improvements.
        
        Args:
            actions: List of recorded actions
            metadata: Recording metadata (startUrl, appType, etc.)
            enhancement_level: "quick" | "standard" | "comprehensive"
            
        Returns:
            Enhanced test case with improved descriptions and suggestions
        """
        metadata = metadata or {}
        
        # Check if OpenAI is available
        openai_service = self._get_openai_service()
        if not openai_service.is_available():
            logger.warning("OpenAI not available, returning basic enhancement")
            return self._basic_enhancement(actions, metadata)
        
        try:
            # Build the prompt
            system_prompt = self._build_system_prompt(enhancement_level)
            user_message = self._build_user_message(actions, metadata)
            
            # Call GPT-4o-mini
            result = await openai_service.rewrite_test_case(
                system_prompt=system_prompt,
                user_message=user_message,
                temperature=0.3,
                max_tokens=2500,
                timeout=45.0
            )
            
            if result.get("success"):
                # Parse the AI response
                enhanced = self._parse_ai_response(result.get("content", ""), actions)
                enhanced["ai_enhanced"] = True
                enhanced["model_used"] = result.get("model", "gpt-4o-mini")
                enhanced["enhancement_level"] = enhancement_level
                return enhanced
            else:
                logger.warning(f"AI enhancement failed: {result.get('error')}")
                return self._basic_enhancement(actions, metadata)
                
        except Exception as e:
            logger.error(f"Error in AI enhancement: {e}", exc_info=True)
            return self._basic_enhancement(actions, metadata)
    
    def _build_system_prompt(self, level: str) -> str:
        """Build system prompt based on enhancement level"""
        base = """You are a QA automation expert. Your task is to enhance recorded browser actions into professional test cases.

RULES:
1. Convert raw actions into clear, readable test steps
2. Generate a meaningful test name that describes the user journey
3. Add appropriate assertions based on the actions
4. Use professional QA terminology
5. Output valid JSON only"""

        if level == "comprehensive":
            base += """
6. Suggest 2-3 additional edge cases to test
7. Identify potential data-driven scenarios
8. Note any accessibility or performance concerns"""
        
        return base
    
    def _build_user_message(self, actions: List[Dict], metadata: Dict) -> str:
        """Build user message with recorded actions"""
        
        # Summarize actions for the prompt
        action_summary = []
        for i, action in enumerate(actions[:30]):  # Limit to 30 actions
            action_type = action.get("type", "unknown")
            desc = action.get("description", "")
            url = action.get("url", "")
            value = action.get("value", "")
            
            summary = f"{i+1}. {action_type}"
            if desc:
                summary += f": {desc}"
            if value:
                summary += f" (value: {value[:50]})"
            if url and action_type == "navigate":
                summary += f" → {url}"
            action_summary.append(summary)
        
        start_url = metadata.get("startUrl") or metadata.get("start_url", "unknown")
        app_type = metadata.get("appType") or metadata.get("app_type", "generic")
        
        return f"""Enhance this recorded browser session into a professional test case.

APPLICATION: {app_type}
START URL: {start_url}
ACTION COUNT: {len(actions)}

RECORDED ACTIONS:
{chr(10).join(action_summary)}

Respond with JSON:
{{
  "test_name": "Descriptive test name",
  "description": "What this test verifies",
  "steps": [
    {{
      "step_number": 1,
      "action": "Clear description of what user does",
      "expected_result": "What should happen",
      "original_action_type": "click|fill|navigate|etc"
    }}
  ],
  "suggested_assertions": [
    "Assertion to add at key points"
  ],
  "tags": ["relevant", "tags"],
  "priority": "high|medium|low",
  "edge_cases": ["Optional edge case suggestions"]
}}"""
    
    def _parse_ai_response(self, content: str, original_actions: List[Dict]) -> Dict[str, Any]:
        """Parse AI response and merge with original data"""
        try:
            # Try to extract JSON from the response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                enhanced = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
            
            # Merge with original action data
            enhanced["original_actions"] = original_actions
            enhanced["action_count"] = len(original_actions)
            enhanced["enhanced_at"] = datetime.now().isoformat()
            
            return enhanced
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}")
            return self._basic_enhancement(original_actions, {})
    
    def _basic_enhancement(self, actions: List[Dict], metadata: Dict) -> Dict[str, Any]:
        """Basic enhancement without AI - fallback"""
        
        # Generate basic test name from actions
        action_types = [a.get("type", "") for a in actions]
        if "fill" in action_types:
            test_name = "Form Submission Flow"
        elif "navigate" in action_types and len(actions) > 5:
            test_name = "Multi-Page Navigation Flow"
        else:
            test_name = "User Interaction Flow"
        
        # Add URL context
        start_url = metadata.get("startUrl") or metadata.get("start_url", "")
        if start_url:
            from urllib.parse import urlparse
            parsed = urlparse(start_url)
            path = parsed.path.strip("/").replace("-", " ").replace("_", " ")
            if path:
                test_name = f"{path.title()} - {test_name}"
        
        # Convert actions to steps
        steps = []
        for i, action in enumerate(actions):
            action_type = action.get("type", "unknown")
            desc = action.get("description", f"{action_type} action")
            
            step = {
                "step_number": i + 1,
                "action": desc,
                "expected_result": self._infer_expected_result(action),
                "original_action_type": action_type
            }
            steps.append(step)
        
        return {
            "test_name": test_name,
            "description": f"Automated test with {len(actions)} steps",
            "steps": steps,
            "suggested_assertions": [],
            "tags": self._infer_tags(actions, metadata),
            "priority": "medium",
            "original_actions": actions,
            "action_count": len(actions),
            "ai_enhanced": False,
            "enhanced_at": datetime.now().isoformat()
        }
    
    def _infer_expected_result(self, action: Dict) -> str:
        """Infer expected result from action type"""
        action_type = action.get("type", "")
        desc = action.get("description", "")
        
        if action_type == "navigate":
            return "Page loads successfully"
        elif action_type == "click":
            if "button" in desc.lower():
                return "Action is triggered"
            elif "link" in desc.lower():
                return "Navigation occurs"
            else:
                return "Element responds to click"
        elif action_type == "fill" or action_type == "type":
            return "Value is entered in field"
        elif action_type == "check":
            return "Checkbox/radio is selected"
        elif action_type == "select":
            return "Option is selected"
        else:
            return "Action completes successfully"
    
    def _infer_tags(self, actions: List[Dict], metadata: Dict) -> List[str]:
        """Infer tags from actions and metadata"""
        tags = []
        
        app_type = metadata.get("appType") or metadata.get("app_type", "")
        if app_type and app_type != "generic":
            tags.append(app_type)
        
        action_types = set(a.get("type", "") for a in actions)
        if "fill" in action_types:
            tags.append("form")
        if "check" in action_types:
            tags.append("checkbox")
        if len([a for a in actions if a.get("type") == "navigate"]) > 2:
            tags.append("multi-page")
        
        tags.append("recorded")
        tags.append("automated")
        
        return tags


# Singleton instance
_enhancer = None

def get_recording_enhancer() -> RecordingEnhancer:
    """Get or create the recording enhancer singleton"""
    global _enhancer
    if _enhancer is None:
        _enhancer = RecordingEnhancer()
    return _enhancer

