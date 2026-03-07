"""
Test Case Rewrite API
FastAPI endpoint for rewriting scenario skeletons into high-quality test cases using LLM.
"""

import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.services.llm.test_case_rewrite_service import (
    TestCaseRewriteService,
    RewriteRequest,
    TestCaseOut
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rewrite-test-case", tags=["test-case-rewrite"])


@router.post("")
async def rewrite_test_case(request: RewriteRequest) -> Dict[str, Any]:
    """
    Rewrite a scenario skeleton into a high-quality test case using LLM.
    Supports both OpenAI (gpt-4o-mini) and Ollama (local models).
    
    Request Body:
    {
        "project_name": "Flowstral Walmart Demo",
        "application_name": "Walmart Custom Cake Ordering",
        "skeleton": {
            "scenario_id": "scenario_1",
            "scenario_type": "functional",
            "high_level_intent": "custom_cake_order",
            "raw_steps": [...]
        }
    }
    
    Response:
    {
        "title": "Configure a Custom 8-Inch Chocolate Cake and Proceed to Checkout",
        "description": "...",
        "test_type": "functional",
        "priority": "high",
        "steps": [...],
        "generation_metrics": {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "latency_ms": 1234.5,
            "tokens_used": 567,
            "cost_usd": 0.000123,
            "success": true
        }
    }
    
    Environment Variables:
    - TEST_CASE_LLM_PROVIDER: "auto" (default), "openai", or "ollama"
    - OPENAI_API_KEY: Required if using OpenAI provider
    """
    try:
        service = TestCaseRewriteService()
        
        # Use quick mode for speed (7B model) or OpenAI if configured
        test_case = await service.rewrite_test_case(
            req=request,
            mode="quick",  # Fast 7B model (only used for Ollama)
            timeout=30.0  # 30 second timeout
        )
        
        # Return as dict to include metrics
        result = test_case.dict()
        
        # Log metrics
        if test_case.generation_metrics:
            metrics = test_case.generation_metrics
            logger.info(
                f"✅ Test case rewrite completed: "
                f"provider={metrics.get('provider')}, "
                f"model={metrics.get('model')}, "
                f"latency={metrics.get('latency_ms', 0):.0f}ms, "
                f"tokens={metrics.get('tokens_used', 'N/A')}, "
                f"cost=${metrics.get('cost_usd', 0):.6f if metrics.get('cost_usd') else 'N/A'}"
            )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to rewrite test case: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to rewrite test case"
        )

