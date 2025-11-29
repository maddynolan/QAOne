"""
Accessibility Report Service
Uses OpenAI to generate human-readable accessibility reports with WCAG compliance insights.
Supports both OpenAI (cloud) and Ollama (local) providers with fallback.
"""

import logging
import json
import os
import time
import asyncio
from typing import Dict, List, Any, Optional

from app.services.llm.ollama_service import OllamaService
from app.services.llm.openai_service import get_openai_service

logger = logging.getLogger(__name__)


class AccessibilityReportService:
    """
    Service for generating human-readable accessibility reports using LLM.
    Supports both OpenAI (gpt-4o-mini) and Ollama (local models) providers.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        
        # Provider selection: "ollama", "openai", or "auto" (try OpenAI first, fallback to Ollama)
        self.provider = os.getenv("ACCESSIBILITY_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"AccessibilityReportService initialized with provider: {self.provider}")
        if self.provider == "openai" and not self.openai_service.is_available():
            logger.warning("OpenAI provider requested but not available - will fallback to Ollama")
        if self.provider == "ollama":
            logger.info("Using Ollama provider (local models) for Accessibility reports")
        elif self.provider == "openai":
            logger.info("Using OpenAI provider (gpt-4o-mini) for Accessibility reports")
        else:
            logger.info("Using auto provider selection (OpenAI first, Ollama fallback) for Accessibility reports")
    
    async def generate_report(
        self,
        wcag_violations: List[Dict[str, Any]],
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Generate human-readable accessibility report with WCAG compliance insights.
        
        Args:
            wcag_violations: List of WCAG violations
            timeout: Timeout in seconds
            
        Returns:
            Dict with report and metrics
        """
        start_time = time.time()
        
        try:
            # Summarize violations for prompt
            violations_summary = self._summarize_violations(wcag_violations)
            
            system_prompt = """You are an accessibility (WCAG) testing expert and technical writer.

Analyze WCAG violations and generate a comprehensive, ELEMENT-SPECIFIC report that is easy to understand and actionable.

Key Requirements:
1. **Element-Specific Findings**: For each violation, identify the ACTUAL ELEMENT (button, link, image, input, etc.) and its context
2. **Understandable Language**: Write findings in plain language, not just rule names
3. **Specific Recommendations**: Provide code examples that match the actual element HTML
4. **Group Similar Issues**: Group identical violations together with counts
5. **Actionable Fixes**: Each fix should be specific to the element type and context

Return ONLY valid JSON with this exact shape:

{
  "summary": {
    "compliance_status": "compliant|partial|non_compliant",
    "compliance_percentage": 0,
    "total_violations": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "elements_affected": 0
  },
  "findings": [
    {
      "finding_id": "string",
      "title": "string (human-readable, e.g., '68 buttons missing accessible names')",
      "element_type": "string (e.g., 'button', 'link', 'image', 'input')",
      "wcag_criterion": "string (e.g., '4.1.2 Name, Role, Value')",
      "severity": "critical|high|medium|low",
      "count": 0,
      "description": "string (explain what's wrong in plain language)",
      "user_impact": "string (how this affects users with disabilities)",
      "affected_elements": [
        {
          "element_description": "string (what the element is, e.g., 'Theme toggle button')",
          "location_hint": "string (where it appears, e.g., 'Header navigation')",
          "html_snippet": "string (relevant HTML)",
          "current_state": "string (what's currently wrong)",
          "recommended_fix": "string (specific fix for this element)",
          "code_example": "string (before/after code example)"
        }
      ],
      "general_fix_guidance": "string (overall guidance for this type of issue)"
    }
  ],
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "category": "string (e.g., 'Buttons', 'Forms', 'Navigation', 'Images')",
      "title": "string",
      "recommendation": "string",
      "affected_elements_count": 0,
      "expected_impact": "string",
      "implementation_steps": ["string"]
    }
  ],
  "compliance_breakdown": {
    "wcag_2_1_aa": {
      "level": "AA",
      "compliant": 0,
      "violations": 0,
      "percentage": 0
    }
  }
}

CRITICAL: 
- Make findings ELEMENT-SPECIFIC, not just rule-driven
- Use the HTML snippets and element context provided to create specific recommendations
- Group identical violations together (e.g., "68 buttons missing accessible names")
- Provide code examples that match the actual element structure"""

            user_message = f"""WCAG Violations Data:
{json.dumps(violations_summary, indent=2)}

Generate a comprehensive, ELEMENT-SPECIFIC accessibility report. 

For each violation type:
1. Identify the actual element (button, link, image, etc.) from the HTML snippets
2. Describe what's wrong in plain language (not just the rule name)
3. Explain the user impact
4. Provide specific fix recommendations with code examples that match the element structure
5. Group identical violations together with counts

Focus on making the report understandable and actionable for developers."""

            # Try OpenAI first
            provider_used = self.provider
            openai_available = self.openai_service.is_available()
            
            if provider_used == "auto" and openai_available:
                logger.info("[AUTO] OpenAI is available, using OpenAI for Accessibility report")
                provider_used = "openai"
            elif provider_used == "auto":
                logger.info("[AUTO] OpenAI not available, using Ollama for Accessibility report")
                provider_used = "ollama"
            
            if provider_used == "openai" and openai_available:
                try:
                    result = await self._call_openai_for_json(
                        system_prompt=system_prompt,
                        user_message=user_message,
                        timeout=timeout
                    )
                    
                    report_data = result.get("response", {})
                    if isinstance(report_data, str):
                        report_data = json.loads(report_data)
                    
                    logger.info(
                        f"✅ Generated Accessibility report "
                        f"(OpenAI, {result.get('latency_ms', 0):.0f}ms, "
                        f"{result.get('tokens_used', 'N/A')} tokens)"
                    )
                    
                    return {
                        "report": report_data,
                        "metrics": {
                            "provider": "openai",
                            "model": "gpt-4o-mini",
                            "latency_ms": result.get("latency_ms", 0),
                            "tokens_used": result.get("tokens_used"),
                            "cost_usd": result.get("cost_usd")
                        }
                    }
                    
                except Exception as e:
                    logger.warning(f"OpenAI report generation failed: {e}, falling back to Ollama")
                    provider_used = "ollama"
            
            # Fallback to Ollama
            if provider_used == "ollama":
                full_prompt = f"{system_prompt}\n\n{user_message}"
                
                try:
                    result = await asyncio.wait_for(
                        self.ollama_service.generate(
                            prompt=full_prompt,
                            mode="quick",
                            validate_json=True,
                            use_fast_model=True,
                            task_type="test_design"
                        ),
                        timeout=timeout
                    )
                except asyncio.TimeoutError:
                    logger.error(f"Ollama report generation timed out after {timeout}s")
                    return self._generate_basic_report(wcag_violations)
                
                response_text = result.get("response", "")
                if response_text:
                    try:
                        report_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse Ollama response, generating basic report")
                        return self._generate_basic_report(wcag_violations)
                else:
                    return self._generate_basic_report(wcag_violations)
                
                return {
                    "report": report_data,
                    "metrics": {
                        "provider": "ollama",
                        "model": result.get("model", "qwen2.5-coder:7b"),
                        "latency_ms": result.get("latency_ms", (time.time() - start_time) * 1000)
                    }
                }
            
            # If no provider worked, return basic report
            return self._generate_basic_report(wcag_violations)
            
        except Exception as e:
            logger.error(f"Failed to generate Accessibility report: {e}", exc_info=True)
            return self._generate_basic_report(wcag_violations)
    
    def _summarize_violations(self, violations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarize WCAG violations with element context for better understanding."""
        # Group violations by rule for better analysis
        violations_by_rule = {}
        for v in violations:
            rule_id = v.get("id") or v.get("rule", "unknown")
            if rule_id not in violations_by_rule:
                violations_by_rule[rule_id] = {
                    "rule": rule_id,
                    "rule_name": v.get("rule", rule_id),
                    "impact": v.get("impact"),
                    "count": 0,
                    "examples": []
                }
            
            violations_by_rule[rule_id]["count"] += 1
            
            # Extract element information from nodes
            nodes = v.get("nodes", [])
            if nodes and len(violations_by_rule[rule_id]["examples"]) < 5:
                for node in nodes[:2]:  # Take up to 2 nodes per violation
                    html = node.get("html", "")
                    # Extract meaningful element info
                    element_info = self._extract_element_info(html, rule_id)
                    if element_info:
                        violations_by_rule[rule_id]["examples"].append({
                            "html_snippet": html[:300],  # Truncate HTML
                            "element_type": element_info.get("type"),
                            "element_context": element_info.get("context"),
                            "current_state": element_info.get("current_state"),
                            "suggested_fix": v.get("suggested_fix", "")
                        })
        
        return {
            "total_violations": len(violations),
            "violations_by_rule": list(violations_by_rule.values()),
            "unique_rules": len(violations_by_rule)
        }
    
    def _extract_element_info(self, html: str, rule_id: str) -> Optional[Dict[str, Any]]:
        """Extract meaningful element information from HTML snippet."""
        import re
        
        if not html or html.strip() == "":
            return None
        
        # Try to identify element type
        element_type = "element"
        context = ""
        current_state = ""
        
        # Extract button info
        if "button" in rule_id.lower() or "<button" in html.lower():
            element_type = "button"
            # Try to extract any text content
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
            # Check for aria-label
            aria_match = re.search(r'aria-label=["\']([^"\']+)["\']', html, re.IGNORECASE)
            if aria_match:
                current_state = f"Has aria-label: {aria_match.group(1)}"
            else:
                current_state = "Missing accessible name"
        
        # Extract link info
        elif "<a " in html.lower() or "link" in rule_id.lower():
            element_type = "link"
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
            href_match = re.search(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
            if href_match:
                current_state = f"Link to: {href_match.group(1)[:50]}"
        
        # Extract image info
        elif "<img" in html.lower() or "image" in rule_id.lower():
            element_type = "image"
            alt_match = re.search(r'alt=["\']([^"\']*)["\']', html, re.IGNORECASE)
            if alt_match:
                current_state = f"Alt text: {alt_match.group(1) or '(empty)'}"
            else:
                current_state = "Missing alt attribute"
            src_match = re.search(r'src=["\']([^"\']+)["\']', html, re.IGNORECASE)
            if src_match:
                context = src_match.group(1).split("/")[-1][:50]
        
        # Extract input info
        elif "<input" in html.lower() or "input" in rule_id.lower():
            element_type = "input"
            type_match = re.search(r'type=["\']([^"\']+)["\']', html, re.IGNORECASE)
            input_type = type_match.group(1) if type_match else "text"
            element_type = f"input ({input_type})"
            label_match = re.search(r'<label[^>]*>([^<]+)</label>', html, re.IGNORECASE)
            if label_match:
                context = label_match.group(1).strip()[:50]
            else:
                current_state = "Missing associated label"
        
        # Extract heading info
        elif re.search(r'<h[1-6]', html, re.IGNORECASE):
            element_type = "heading"
            level_match = re.search(r'<h([1-6])', html, re.IGNORECASE)
            level = level_match.group(1) if level_match else "?"
            element_type = f"heading (h{level})"
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
        
        # Generic element
        else:
            tag_match = re.search(r'<(\w+)', html, re.IGNORECASE)
            if tag_match:
                element_type = tag_match.group(1)
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
        
        return {
            "type": element_type,
            "context": context or "No context available",
            "current_state": current_state or "Needs review"
        }
    
    def _generate_basic_report(self, violations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate basic report without LLM (fallback)."""
        critical = [v for v in violations if v.get("impact") == "critical"]
        serious = [v for v in violations if v.get("impact") == "serious"]
        moderate = [v for v in violations if v.get("impact") == "moderate"]
        minor = [v for v in violations if v.get("impact") == "minor"]
        
        total = len(violations)
        compliance_pct = max(0, 100 - (total * 2))  # Rough estimate
        
        return {
            "report": {
                "summary": {
                    "compliance_status": "non_compliant" if total > 0 else "compliant",
                    "compliance_percentage": compliance_pct,
                    "total_violations": total,
                    "critical": len(critical),
                    "high": len(serious),
                    "medium": len(moderate),
                    "low": len(minor)
                },
                "findings": [
                    {
                        "violation_id": v.get("id", ""),
                        "wcag_criterion": v.get("id", "Unknown"),
                        "severity": v.get("impact", "medium"),
                        "impact": v.get("impact", ""),
                        "description": v.get("description", ""),
                        "affected_elements": v.get("nodes", [])[:5],
                        "fix_suggestion": "Review and fix accessibility issue"
                    }
                    for v in violations[:20]
                ],
                "recommendations": [
                    {
                        "priority": "high",
                        "category": "Accessibility",
                        "recommendation": "Fix critical and serious WCAG violations",
                        "expected_impact": "Improve compliance by 30-50%"
                    }
                ] if violations else [],
                "compliance_breakdown": {
                    "wcag_2_1_aa": {
                        "level": "AA",
                        "compliant": max(0, 100 - total),
                        "violations": total,
                        "percentage": compliance_pct
                    }
                }
            },
            "metrics": {
                "provider": "fallback",
                "error": "LLM unavailable, using basic report"
            }
        }
    
    async def _call_openai_for_json(
        self,
        system_prompt: str,
        user_message: str,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """Call OpenAI API for JSON response."""
        if not self.openai_service.is_available():
            raise ValueError("OpenAI service not available")
        
        start_time = time.time()
        
        try:
            response = await asyncio.wait_for(
                self.openai_service._client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.2,
                    max_tokens=2000,
                    response_format={"type": "json_object"}
                ),
                timeout=timeout
            )
            
            latency_ms = (time.time() - start_time) * 1000
            content = response.choices[0].message.content
            usage = response.usage
            
            # Calculate cost
            input_tokens = usage.prompt_tokens if usage else 0
            output_tokens = usage.completion_tokens if usage else 0
            total_tokens = usage.total_tokens if usage else 0
            
            cost_usd = (
                (input_tokens / 1_000_000) * 0.15 +
                (output_tokens / 1_000_000) * 0.60
            )
            
            return {
                "response": json.loads(content),
                "model": "gpt-4o-mini",
                "latency_ms": latency_ms,
                "tokens_used": total_tokens,
                "cost_usd": cost_usd
            }
            
        except asyncio.TimeoutError:
            raise TimeoutError(f"OpenAI API call timed out after {timeout}s")
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}", exc_info=True)
            raise


# Global instance
_accessibility_report_service = None

def get_accessibility_report_service() -> AccessibilityReportService:
    """Get or create global AccessibilityReportService instance"""
    global _accessibility_report_service
    if _accessibility_report_service is None:
        _accessibility_report_service = AccessibilityReportService()
    return _accessibility_report_service

