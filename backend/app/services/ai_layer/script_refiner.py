"""
Script Refiner - Thin AI Layer
Refines generated scripts to be more idiomatic and readable.
Only uses LLM for code style, not for logic generation.
"""

import logging
from typing import Dict, Any, Optional
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


class ScriptRefiner:
    """
    Refines generated scripts using LLM.
    Input: Template-generated script (deterministic)
    Output: Idiomatic, well-commented, refactored script
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def refine_script(
        self,
        script: str,
        framework: str = "playwright",
        tenant_id: Optional[str] = None
    ) -> str:
        """
        Refine a generated script.
        
        Args:
            script: Template-generated script code
            framework: Test framework (playwright, cypress, etc.)
            tenant_id: Tenant ID for LLM calls
            
        Returns:
            Refined script with better naming, comments, structure
        """
        prompt = f"""Refine this {framework} test script to be more idiomatic and readable.

ORIGINAL SCRIPT:
```javascript
{script}
```

INSTRUCTIONS:
1. Add helpful comments explaining what each section does
2. Group related steps into helper functions if appropriate
3. Improve variable and function names for clarity
4. Add proper error handling if missing
5. Keep all the original logic - only improve style and readability
6. Maintain the same test structure and assertions

Respond with ONLY the refined code, no explanations."""
        
        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",  # Use better model for code refinement
            validate_json=False,  # Code is not JSON
            task_type="automation",
            max_tokens=2000,
            use_fast_model=False  # Use better model for code quality
        )
        
        try:
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            if result and result.response:
                # Extract code from markdown if present
                refined = result.response
                if "```" in refined:
                    import re
                    match = re.search(r'```(?:javascript|typescript|js|ts)?\s*\n?(.*?)\n?```', refined, re.DOTALL)
                    if match:
                        refined = match.group(1).strip()
                
                logger.info(f"Refined script (length: {len(refined)} chars)")
                return refined
            else:
                logger.warning("LLM returned empty response for refinement, using original")
                return script
                
        except Exception as e:
            logger.warning(f"Script refinement failed: {e}, using original")
            return script



