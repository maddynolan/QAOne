"""
Security Report Service
Uses OpenAI to generate human-readable security reports with vulnerability insights.
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


class SecurityReportService:
    """
    Service for generating human-readable security reports using LLM.
    Supports both OpenAI (gpt-4o-mini) and Ollama (local models) providers.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        
        # Provider selection: "ollama", "openai", or "auto" (try OpenAI first, fallback to Ollama)
        self.provider = os.getenv("SECURITY_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"SecurityReportService initialized with provider: {self.provider}")
        if self.provider == "openai" and not self.openai_service.is_available():
            logger.warning("OpenAI provider requested but not available - will fallback to Ollama")
        if self.provider == "ollama":
            logger.info("Using Ollama provider (local models) for Security reports")
        elif self.provider == "openai":
            logger.info("Using OpenAI provider (gpt-4o-mini) for Security reports")
        else:
            logger.info("Using auto provider selection (OpenAI first, Ollama fallback) for Security reports")
    
    async def generate_report(
        self,
        defects: List[Dict[str, Any]],
        action_graph: Optional[Dict[str, Any]] = None,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Generate human-readable security report with vulnerability insights.
        
        Args:
            defects: List of defects/issues found
            action_graph: Optional action graph for context
            timeout: Timeout in seconds
            
        Returns:
            Dict with report and metrics
        """
        start_time = time.time()
        
        try:
            # Filter security-related defects
            security_defects = [d for d in defects if d.get("type") == "security" or "security" in d.get("category", "").lower()]
            all_defects_summary = self._summarize_defects(defects)
            
            system_prompt = """You are a security testing expert.

Analyze defects and potential security vulnerabilities and generate a comprehensive report with:
- Executive summary (security posture, total vulnerabilities by severity)
- Detailed findings (each vulnerability with impact, CVE references if applicable, affected components)
- Risk assessment (likelihood, impact, overall risk score)
- Remediation recommendations (priority, fix steps, code examples where applicable)
- Compliance status (OWASP Top 10, security best practices)

Return ONLY valid JSON with this exact shape:

{
  "summary": {
    "security_posture": "secure|vulnerable|critical",
    "total_vulnerabilities": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "findings": [
    {
      "vulnerability_id": "string",
      "title": "string",
      "severity": "critical|high|medium|low",
      "category": "string (e.g., 'XSS', 'SQL Injection', 'Authentication')",
      "impact": "string",
      "description": "string",
      "affected_components": ["string"],
      "cve_reference": "string (optional)",
      "owasp_category": "string (optional)",
      "likelihood": "high|medium|low",
      "risk_score": 0
    }
  ],
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "category": "string",
      "recommendation": "string",
      "fix_steps": ["string"],
      "code_example": "string (optional)"
    }
  ],
  "compliance": {
    "owasp_top_10": {
      "compliant": 0,
      "violations": 0,
      "percentage": 0
    }
  }
}"""

            user_message = f"""Defects and Issues:
{json.dumps(all_defects_summary, indent=2)}

Generate a comprehensive security report with actionable remediation steps."""

            # Try OpenAI first
            provider_used = self.provider
            openai_available = self.openai_service.is_available()
            
            if provider_used == "auto" and openai_available:
                logger.info("[AUTO] OpenAI is available, using OpenAI for Security report")
                provider_used = "openai"
            elif provider_used == "auto":
                logger.info("[AUTO] OpenAI not available, using Ollama for Security report")
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
                        f"✅ Generated Security report "
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
                    return self._generate_basic_report(defects)
                
                response_text = result.get("response", "")
                if response_text:
                    try:
                        report_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse Ollama response, generating basic report")
                        return self._generate_basic_report(defects)
                else:
                    return self._generate_basic_report(defects)
                
                return {
                    "report": report_data,
                    "metrics": {
                        "provider": "ollama",
                        "model": result.get("model", "qwen2.5-coder:7b"),
                        "latency_ms": result.get("latency_ms", (time.time() - start_time) * 1000)
                    }
                }
            
            # If no provider worked, return basic report
            return self._generate_basic_report(defects)
            
        except Exception as e:
            logger.error(f"Failed to generate Security report: {e}", exc_info=True)
            return self._generate_basic_report(defects)
    
    def _summarize_defects(self, defects: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarize defects to reduce token usage."""
        # Limit to 50 defects
        defects = defects[:50]
        
        summarized = []
        for d in defects:
            summarized.append({
                "id": d.get("id"),
                "type": d.get("type"),
                "category": d.get("category"),
                "severity": d.get("severity"),
                "description": d.get("description", "")[:200],  # Truncate
                "url": d.get("url", "")
            })
        
        return {
            "total_defects": len(defects),
            "defects": summarized
        }
    
    def _generate_basic_report(self, defects: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate basic report without LLM (fallback)."""
        security_defects = [d for d in defects if d.get("type") == "security" or "security" in d.get("category", "").lower()]
        
        critical = [d for d in security_defects if d.get("severity") == "critical"]
        high = [d for d in security_defects if d.get("severity") == "high"]
        medium = [d for d in security_defects if d.get("severity") == "medium"]
        low = [d for d in security_defects if d.get("severity") == "low"]
        
        return {
            "report": {
                "summary": {
                    "security_posture": "critical" if critical else "vulnerable" if high else "secure",
                    "total_vulnerabilities": len(security_defects),
                    "critical": len(critical),
                    "high": len(high),
                    "medium": len(medium),
                    "low": len(low)
                },
                "findings": [
                    {
                        "vulnerability_id": d.get("id", ""),
                        "title": d.get("title", d.get("description", "")[:50]),
                        "severity": d.get("severity", "medium"),
                        "category": d.get("category", "Security"),
                        "impact": d.get("description", ""),
                        "description": d.get("description", ""),
                        "affected_components": [d.get("url", "")]
                    }
                    for d in security_defects[:20]
                ],
                "recommendations": [
                    {
                        "priority": "high",
                        "category": "Security",
                        "recommendation": "Review and fix security vulnerabilities",
                        "fix_steps": ["Identify root cause", "Implement fix", "Test remediation"]
                    }
                ] if security_defects else [],
                "compliance": {
                    "owasp_top_10": {
                        "compliant": max(0, 100 - len(security_defects)),
                        "violations": len(security_defects),
                        "percentage": max(0, 100 - len(security_defects))
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
_security_report_service = None

def get_security_report_service() -> SecurityReportService:
    """Get or create global SecurityReportService instance"""
    global _security_report_service
    if _security_report_service is None:
        _security_report_service = SecurityReportService()
    return _security_report_service







