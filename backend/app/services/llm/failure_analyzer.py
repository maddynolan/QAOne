"""
AI-Powered Failure Analysis Service
====================================

POST-RUN analysis of test failures. This runs AFTER the test completes,
not during execution, to minimize AI costs.

One AI call per failure - batches all context into a single analysis.
"""

import logging
import json
import os
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import OpenAI
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


@dataclass
class FailureAnalysis:
    """Result of AI failure analysis"""
    root_cause: str  # element_changed, timing_issue, app_bug, env_issue, test_issue
    category: str    # selector, timing, network, assertion, config
    confidence: float
    explanation: str
    suggested_fix: str
    fix_type: str    # update_selector, add_wait, update_assertion, config_change, investigate
    additional_context: Dict[str, Any] = None


class FailureAnalyzer:
    """
    Analyze test failures using AI to identify root cause and suggest fixes.
    
    This is a POST-RUN service - called after test execution completes,
    not during. This allows batch analysis and cost control.
    
    Cost: ~$0.01-0.02 per failure analysis (GPT-4o-mini)
    """
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        """
        Initialize the failure analyzer.
        
        Args:
            api_key: OpenAI API key (uses shared config or env var)
            model: Model to use (default: gpt-4o-mini for cost efficiency)
        """
        # Try to get API key from shared config first (same as explorer/flowmap)
        if api_key is None:
            try:
                from app.routers.vision_healing_api import get_openai_api_key
                api_key = get_openai_api_key()
            except ImportError:
                pass
        
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.client = None
        self.available = False
        
        self._init_client()
    
    def _init_client(self):
        """Initialize or reinitialize the OpenAI client."""
        if OPENAI_AVAILABLE and self.api_key:
            try:
                self.client = AsyncOpenAI(api_key=self.api_key)
                self.available = True
                logger.info(f"FailureAnalyzer initialized with {self.model}")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI: {e}")
    
    def refresh_api_key(self):
        """Refresh API key from shared config (call if key was updated)."""
        try:
            from app.routers.vision_healing_api import get_openai_api_key
            new_key = get_openai_api_key()
            if new_key and new_key != self.api_key:
                self.api_key = new_key
                self._init_client()
                return True
        except ImportError:
            pass
        return False
    
    async def analyze_failure(
        self,
        error_message: str,
        step_info: Dict[str, Any],
        screenshot_b64: Optional[str] = None,
        dom_snapshot: Optional[str] = None,
        console_logs: Optional[List[str]] = None,
        network_errors: Optional[List[str]] = None,
        previous_steps: Optional[List[Dict[str, Any]]] = None
    ) -> FailureAnalysis:
        """
        Analyze a test failure and provide root cause + fix suggestion.
        
        Args:
            error_message: The error that occurred
            step_info: Information about the failed step
            screenshot_b64: Screenshot at failure (optional)
            dom_snapshot: DOM state at failure (optional, truncated)
            console_logs: Browser console logs (optional)
            network_errors: Failed network requests (optional)
            previous_steps: Steps executed before failure (optional)
            
        Returns:
            FailureAnalysis with root cause and fix suggestion
        """
        if not self.available:
            return FailureAnalysis(
                root_cause="unknown",
                category="unknown",
                confidence=0.0,
                explanation="AI analysis not available (no API key)",
                suggested_fix="Please review manually",
                fix_type="investigate"
            )
        
        try:
            # Build the analysis prompt
            prompt = self._build_analysis_prompt(
                error_message=error_message,
                step_info=step_info,
                dom_snapshot=dom_snapshot,
                console_logs=console_logs,
                network_errors=network_errors,
                previous_steps=previous_steps
            )
            
            # Prepare messages
            messages = [
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": prompt}
            ]
            
            # Add screenshot if available (vision capability)
            if screenshot_b64 and self.model in ["gpt-4o", "gpt-4o-mini"]:
                # Include image in the analysis
                image_url = f"data:image/png;base64,{screenshot_b64}" if not screenshot_b64.startswith('data:') else screenshot_b64
                messages[1] = {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url, "detail": "low"}}  # low detail for cost
                    ]
                }
            
            # Call AI
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=800,
                temperature=0.1
            )
            
            result_text = response.choices[0].message.content
            
            # Parse JSON response
            return self._parse_analysis(result_text)
            
        except Exception as e:
            logger.error(f"Failure analysis error: {e}")
            return FailureAnalysis(
                root_cause="analysis_error",
                category="unknown",
                confidence=0.0,
                explanation=f"Analysis failed: {str(e)}",
                suggested_fix="Please review manually",
                fix_type="investigate"
            )
    
    def _get_system_prompt(self) -> str:
        """System prompt for failure analysis."""
        return """You are an expert test automation engineer analyzing test failures.

Analyze the failure and return a JSON object with:
{
    "root_cause": "element_changed" | "timing_issue" | "app_bug" | "env_issue" | "test_issue",
    "category": "selector" | "timing" | "network" | "assertion" | "config",
    "confidence": 0.0-1.0,
    "explanation": "Clear explanation of what went wrong",
    "suggested_fix": "Specific actionable fix",
    "fix_type": "update_selector" | "add_wait" | "update_assertion" | "config_change" | "investigate"
}

Root cause categories:
- element_changed: UI element was modified (ID, class, structure changed)
- timing_issue: Element not loaded in time, race condition
- app_bug: Application has a bug (not test's fault)
- env_issue: Environment problem (network, auth, config)
- test_issue: Test logic is wrong or outdated

Be specific and actionable in your suggestions."""

    def _build_analysis_prompt(
        self,
        error_message: str,
        step_info: Dict[str, Any],
        dom_snapshot: Optional[str],
        console_logs: Optional[List[str]],
        network_errors: Optional[List[str]],
        previous_steps: Optional[List[Dict[str, Any]]]
    ) -> str:
        """Build the analysis prompt with all context."""
        
        prompt_parts = [
            "## Test Failure Analysis Request",
            "",
            f"**Error Message:** {error_message}",
            "",
            "**Failed Step:**",
            f"- Action: {step_info.get('action', 'unknown')}",
            f"- Selector: {step_info.get('selector', 'N/A')}",
            f"- Description: {step_info.get('description', 'N/A')}",
            f"- Value: {step_info.get('value', 'N/A')}",
        ]
        
        # Add element info if available
        if step_info.get('element'):
            elem = step_info['element']
            prompt_parts.extend([
                "",
                "**Element Info:**",
                f"- Tag: {elem.get('tagName', 'N/A')}",
                f"- Text: {elem.get('text', 'N/A')}",
                f"- Role: {elem.get('role', 'N/A')}",
                f"- TestID: {elem.get('testId', 'N/A')}",
            ])
        
        # Add console errors
        if console_logs:
            prompt_parts.extend([
                "",
                "**Console Errors:**",
                *[f"- {log}" for log in console_logs[:5]]  # Limit to 5
            ])
        
        # Add network errors
        if network_errors:
            prompt_parts.extend([
                "",
                "**Network Errors:**",
                *[f"- {err}" for err in network_errors[:3]]  # Limit to 3
            ])
        
        # Add DOM snippet if available
        if dom_snapshot:
            # Truncate to relevant portion
            snippet = dom_snapshot[:2000]
            prompt_parts.extend([
                "",
                "**DOM Snippet (truncated):**",
                f"```html",
                snippet,
                "```"
            ])
        
        # Add previous steps context
        if previous_steps:
            prompt_parts.extend([
                "",
                "**Previous Steps (context):**",
                *[f"- {s.get('action', 'unknown')}: {s.get('description', 'N/A')}" for s in previous_steps[-3:]]
            ])
        
        prompt_parts.extend([
            "",
            "Analyze this failure and provide your diagnosis in JSON format."
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_analysis(self, result_text: str) -> FailureAnalysis:
        """Parse AI response into FailureAnalysis."""
        try:
            # Extract JSON from response
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            data = json.loads(result_text.strip())
            
            return FailureAnalysis(
                root_cause=data.get("root_cause", "unknown"),
                category=data.get("category", "unknown"),
                confidence=float(data.get("confidence", 0.5)),
                explanation=data.get("explanation", "No explanation provided"),
                suggested_fix=data.get("suggested_fix", "Please review manually"),
                fix_type=data.get("fix_type", "investigate"),
                additional_context=data.get("additional_context")
            )
            
        except json.JSONDecodeError:
            # Try to extract key information even if not valid JSON
            return FailureAnalysis(
                root_cause="unknown",
                category="unknown",
                confidence=0.3,
                explanation=result_text[:500],  # Use raw response as explanation
                suggested_fix="Please review the AI response manually",
                fix_type="investigate"
            )
    
    async def analyze_batch(
        self,
        failures: List[Dict[str, Any]]
    ) -> List[FailureAnalysis]:
        """
        Analyze multiple failures.
        
        For cost efficiency, this still makes individual calls but
        could be optimized to batch similar failures.
        """
        results = []
        for failure in failures:
            result = await self.analyze_failure(
                error_message=failure.get('error', 'Unknown error'),
                step_info=failure.get('step', {}),
                screenshot_b64=failure.get('screenshot'),
                dom_snapshot=failure.get('dom'),
                console_logs=failure.get('console_logs'),
                network_errors=failure.get('network_errors'),
                previous_steps=failure.get('previous_steps')
            )
            results.append(result)
        return results


# Singleton instance
_analyzer_instance: Optional[FailureAnalyzer] = None

def get_failure_analyzer() -> FailureAnalyzer:
    """Get or create the singleton analyzer instance."""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = FailureAnalyzer()
    return _analyzer_instance
