"""
Performance Report Service
Uses OpenAI to generate human-readable performance reports with insights and recommendations.
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


class PerformanceReportService:
    """
    Service for generating human-readable performance reports using LLM.
    Supports both OpenAI (gpt-4o-mini) and Ollama (local models) providers.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        
        # Provider selection: "ollama", "openai", or "auto" (try OpenAI first, fallback to Ollama)
        self.provider = os.getenv("PERFORMANCE_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"PerformanceReportService initialized with provider: {self.provider}")
        if self.provider == "openai" and not self.openai_service.is_available():
            logger.warning("OpenAI provider requested but not available - will fallback to Ollama")
        if self.provider == "ollama":
            logger.info("Using Ollama provider (local models) for Performance reports")
        elif self.provider == "openai":
            logger.info("Using OpenAI provider (gpt-4o-mini) for Performance reports")
        else:
            logger.info("Using auto provider selection (OpenAI first, Ollama fallback) for Performance reports")
    
    async def generate_report(
        self,
        performance_metrics: Dict[str, Any],
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Generate human-readable performance report with insights and recommendations.
        
        Args:
            performance_metrics: Performance metrics dictionary
            timeout: Timeout in seconds
            
        Returns:
            Dict with report and metrics
        """
        start_time = time.time()
        
        try:
            # Summarize metrics for prompt
            metrics_summary = self._summarize_metrics(performance_metrics)
            
            system_prompt = """You are a performance testing expert.

Analyze performance metrics and generate a comprehensive report with:
- Executive summary (overall performance status)
- Key findings (bottlenecks, slow pages, issues)
- Detailed analysis (page-by-page breakdown)
- Recommendations (optimization suggestions with priority)
- Priority classification (critical/high/medium/low for each issue)

Return ONLY valid JSON with this exact shape:

{
  "summary": {
    "overall_status": "good|warning|critical",
    "average_latency_ms": 0,
    "total_pages_tested": 0,
    "bottlenecks_count": 0
  },
  "findings": [
    {
      "page_url": "string",
      "latency_ms": 0,
      "issue": "string",
      "severity": "critical|high|medium|low",
      "description": "string"
    }
  ],
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "category": "string (e.g., 'Caching', 'Database', 'Network')",
      "recommendation": "string",
      "expected_improvement": "string"
    }
  ],
  "bottlenecks": [
    {
      "page_url": "string",
      "latency_ms": 0,
      "impact": "string"
    }
  ]
}"""

            user_message = f"""Performance Metrics:
{json.dumps(metrics_summary, indent=2)}

Generate a comprehensive performance report with insights and actionable recommendations."""

            # Try OpenAI first
            provider_used = self.provider
            openai_available = self.openai_service.is_available()
            
            if provider_used == "auto" and openai_available:
                logger.info("[AUTO] OpenAI is available, using OpenAI for Performance report")
                provider_used = "openai"
            elif provider_used == "auto":
                logger.info("[AUTO] OpenAI not available, using Ollama for Performance report")
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
                        f"✅ Generated Performance report "
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
                    # Return basic report
                    return self._generate_basic_report(performance_metrics)
                
                response_text = result.get("response", "")
                if response_text:
                    try:
                        report_data = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse Ollama response, generating basic report")
                        return self._generate_basic_report(performance_metrics)
                else:
                    return self._generate_basic_report(performance_metrics)
                
                return {
                    "report": report_data,
                    "metrics": {
                        "provider": "ollama",
                        "model": result.get("model", "qwen2.5-coder:7b"),
                        "latency_ms": result.get("latency_ms", (time.time() - start_time) * 1000)
                    }
                }
            
            # If no provider worked, return basic report
            return self._generate_basic_report(performance_metrics)
            
        except Exception as e:
            logger.error(f"Failed to generate Performance report: {e}", exc_info=True)
            return self._generate_basic_report(performance_metrics)
    
    def _summarize_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize performance metrics to reduce token usage."""
        # Extract key metrics
        metrics_by_node = metrics.get("metrics_by_node", [])[:30]  # Limit to 30 nodes
        bottlenecks = metrics.get("bottlenecks", [])[:10]  # Limit to 10 bottlenecks
        
        return {
            "average_latency_ms": metrics.get("average_latency_ms", 0),
            "total_nodes": metrics.get("total_nodes", 0),
            "metrics_by_node": metrics_by_node,
            "bottlenecks": bottlenecks,
            "edge_metrics": metrics.get("edge_metrics", [])[:20]  # Limit to 20 edges
        }
    
    def _generate_basic_report(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Generate basic report without LLM (fallback)."""
        avg_latency = metrics.get("average_latency_ms", 0)
        bottlenecks = metrics.get("bottlenecks", [])
        
        return {
            "report": {
                "summary": {
                    "overall_status": "warning" if avg_latency > 1000 else "good",
                    "average_latency_ms": avg_latency,
                    "total_pages_tested": metrics.get("total_nodes", 0),
                    "bottlenecks_count": len(bottlenecks)
                },
                "findings": [
                    {
                        "page_url": b.get("url", ""),
                        "latency_ms": b.get("latency_ms", 0),
                        "issue": "High latency detected",
                        "severity": "high" if b.get("latency_ms", 0) > 2000 else "medium",
                        "description": f"Page load time of {b.get('latency_ms', 0)}ms exceeds recommended threshold"
                    }
                    for b in bottlenecks[:10]
                ],
                "recommendations": [
                    {
                        "priority": "high",
                        "category": "Performance",
                        "recommendation": "Optimize slow-loading pages",
                        "expected_improvement": "Reduce latency by 30-50%"
                    }
                ] if bottlenecks else [],
                "bottlenecks": bottlenecks[:10]
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
_performance_report_service = None

def get_performance_report_service() -> PerformanceReportService:
    """Get or create global PerformanceReportService instance"""
    global _performance_report_service
    if _performance_report_service is None:
        _performance_report_service = PerformanceReportService()
    return _performance_report_service

