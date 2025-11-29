"""
Enhanced Generation Service - Integrates RAG, caching, and model routing
Main service for generating test cases with full RAG + caching pipeline
"""

import logging
import time
import json
from typing import Dict, Any, Optional, List
import asyncio

from app.services.utils.embedding_service import embedding_service
from app.services.utils.rag_service import rag_service
from app.services.core.cache_service import cache_service
from app.services.llm.model_router import model_router, ModelChoice
from app.services.llm.ollama_service import ollama_service
from app.services.llm.prompt.prompt_templates import PROMPT_REQ_TO_MANUAL_TESTS
from app.services.utils.test_generation_optimizer import extract_json_from_response, is_valid_test_case_json
from app.services.core.metrics_service import metrics_service
from app.services.llm.prompt.prompt_template_service import prompt_template_service

logger = logging.getLogger(__name__)

class EnhancedGenerationService:
    """Enhanced test generation with RAG + caching"""
    
    async def initialize(self):
        """Initialize all services"""
        await embedding_service.initialize()
        await cache_service.initialize()
        await ollama_service.initialize()
        await metrics_service.initialize()
    
    async def cleanup(self):
        """Cleanup all services"""
        await embedding_service.cleanup()
        await cache_service.cleanup()
        await ollama_service.cleanup()
        await metrics_service.cleanup()
    
    async def generate_test_cases(
        self,
        requirement: str,
        organization_id: str,
        project_id: Optional[str] = None,
        test_type: str = "manual",
        user_mode: Optional[str] = None,  # 'quick' or 'deep' override
        prompt_template_version: str = "v1.0"
    ) -> Dict[str, Any]:
        """
        Generate test cases with full RAG + caching pipeline
        
        Args:
            requirement: User requirement/story
            organization_id: Organization ID
            project_id: Optional project ID
            test_type: Type of test ('manual', 'automated', 'api', etc.)
            user_mode: User override ('quick' or 'deep')
            prompt_template_version: Prompt template version
            
        Returns:
            Dict with test_cases, metadata, and cache info
        """
        start_time = time.time()
        cache_hit = None
        cache_level = None
        
        try:
            # Step 1: Get template version first (needed for cache key)
            task = prompt_template_service.get_task_for_test_type(test_type)
            _, template_version = await prompt_template_service.get_template(
                task=task,
                organization_id=organization_id,
                project_id=project_id,
                version=prompt_template_version
            )
            actual_template_version = prompt_template_version or template_version
            
            # Step 2: Normalize and generate cache key
            normalized_req = embedding_service.normalize_text_for_embedding(requirement)
            
            # Step 3: Check L1 cache (exact match)
            l1_check_start = time.time()
            cache_key = cache_service._generate_cache_key(
                org_id=organization_id,
                prompt=normalized_req,
                model_version="any",  # Will be updated after model selection
                test_type=test_type,
                project_id=project_id,
                prompt_template_version=actual_template_version
            )
            
            # Try L1 cache with different model versions
            l1_hit = False
            for model_ver in ["qwen2.5:7b-instruct", "qwen2.5-coder:14b"]:
                cache_key_with_model = cache_service._generate_cache_key(
                    org_id=organization_id,
                    prompt=normalized_req,
                    model_version=model_ver,
                    test_type=test_type,
                    project_id=project_id,
                    prompt_template_version=actual_template_version
                )
                
                cached = await cache_service.l1_get(cache_key_with_model)
                if cached:
                    latency_ms = int((time.time() - start_time) * 1000)
                    logger.info(f"L1 cache HIT for {model_ver}")
                    
                    # Track metrics
                    await metrics_service.record_cache_hit(organization_id, "L1", latency_ms)
                    l1_hit = True
                    
                    return {
                        "status": "success",
                        "test_cases": cached.get("test_cases", []),
                        "model": model_ver,
                        "latency_ms": latency_ms,
                        "cache_hit": True,
                        "cache_level": "L1",
                        "source": "cache"
                    }
            
            # Track L1 miss (if we got here, no L1 cache hit)
            if not l1_hit:
                await metrics_service.record_cache_miss(organization_id, "L1")
            
            # Step 3: Generate query embedding for RAG and L2 cache
            query_embedding = await embedding_service.generate_embedding(normalized_req)
            
            # Step 4: Check L2 cache (semantic similarity)
            l2_check_start = time.time()
            l2_result = await cache_service.l2_semantic_get(
                organization_id=organization_id,
                query_embedding=query_embedding,
                project_id=project_id,
                test_type=test_type
            )
            
            if l2_result:
                cached_response, similarity = l2_result
                l2_latency_ms = int((time.time() - l2_check_start) * 1000)
                total_latency_ms = int((time.time() - start_time) * 1000)
                logger.info(f"L2 cache HIT: similarity={similarity:.2%}")
                
                # Track metrics
                await metrics_service.record_cache_hit(organization_id, "L2", l2_latency_ms)
                
                # Store in L1 for faster future access
                model_used = cached_response.get("model", "qwen2.5-coder:14b")
                cache_key_final = cache_service._generate_cache_key(
                    org_id=organization_id,
                    prompt=normalized_req,
                    model_version=model_used,
                    test_type=test_type,
                    project_id=project_id,
                    prompt_template_version=actual_template_version
                )
                await cache_service.l1_set(cache_key_final, cached_response)
                
                return {
                    "status": "success",
                    "test_cases": cached_response.get("test_cases", []),
                    "model": model_used,
                    "latency_ms": total_latency_ms,
                    "cache_hit": True,
                    "cache_level": "L2",
                    "similarity": similarity,
                    "source": "cache"
                }
            
            # Track L2 miss
            await metrics_service.record_cache_miss(organization_id, "L2")
            
            # Step 5: RAG retrieval (no cache hit, need to generate)
            rag_results = await rag_service.search_similar_requirements(
                organization_id=organization_id,
                query_embedding=query_embedding,
                limit=5,
                project_id=project_id
            )
            
            # Step 6: Build RAG context
            rag_context = await rag_service.build_rag_context(
                organization_id=organization_id,
                query_embedding=query_embedding,
                limit=5,
                project_id=project_id
            ) if rag_results else None
            
            # Step 7: Choose model (intelligent routing)
            # If user explicitly wants "quick", respect it and use trained model
            if user_mode == "quick":
                model_choice = ModelChoice.QUICK
                print(f"[INFO] ENHANCED_GENERATION - User requested 'quick' mode, using ModelChoice.QUICK")
                logger.info(f"User requested 'quick' mode, using ModelChoice.QUICK")
            else:
                model_choice = model_router.choose_model(
                    prompt=requirement,
                    rag_results=rag_results,
                    user_override=user_mode,
                    test_type=test_type
                )
                print(f"[INFO] ENHANCED_GENERATION - Model router chose: {model_choice.value} (user_mode: {user_mode})")
                logger.info(f"Model router chose: {model_choice.value} (user_mode: {user_mode})")
            
            model_info = model_router.get_model_info(model_choice)
            model_name = model_info['model']
            print(f"[INFO] ENHANCED_GENERATION - Model name: {model_name}, Model choice: {model_choice.value}")
            logger.info(f"Model name: {model_name}, Model choice: {model_choice.value}")
            
            # Step 8: Build prompt with RAG context (use version we already got)
            prompt, _ = await self._build_prompt(
                requirement=requirement,
                rag_context=rag_context,
                test_type=test_type,
                organization_id=organization_id,
                project_id=project_id,
                prompt_template_version=actual_template_version
            )
            
            # Step 9: Generate with LLM
            logger.info(f"Generating with {model_name} (no cache hit)")
            generation_start = time.time()
            
            result = await ollama_service.generate(
                prompt=prompt,
                mode=model_choice.value,
                max_retries=2,
                validate_json=False
            )
            
            raw_response = result.get("response", "")
            model_used = result.get("model", model_name)
            generation_latency = int((time.time() - generation_start) * 1000)
            total_latency = int((time.time() - start_time) * 1000)
            
            # Estimate tokens (rough estimate: 1 token ≈ 4 characters)
            estimated_tokens = len(prompt) // 4 + len(raw_response) // 4
            
            # Track generation metrics
            await metrics_service.record_generation(
                org_id=organization_id,
                model=model_used,
                latency_ms=total_latency,
                cache_hit=False,
                rag_used=bool(rag_results),
                rag_similarity=rag_results[0]['similarity'] if rag_results else None,
                tokens_estimated=estimated_tokens
            )
            
            # Step 10: Extract and validate JSON
            test_cases = extract_json_from_response(raw_response)
            
            if not test_cases:
                # Retry with fixup prompt
                logger.warning("No JSON extracted, retrying with fixup prompt...")
                fixup_prompt = f"""{prompt}

IMPORTANT: Your response must be ONLY a valid JSON array. No markdown, no explanations, no text. Just the JSON array."""
                result2 = await ollama_service.generate(fixup_prompt, mode=model_choice.value, max_retries=1, validate_json=False)
                test_cases = extract_json_from_response(result2.get("response", ""))
            
            if not test_cases:
                raise Exception(f"Model did not return valid JSON. Response: {raw_response[:200]}")
            
            if not isinstance(test_cases, list):
                test_cases = [test_cases]
            
            if not is_valid_test_case_json(test_cases):
                logger.warning("Test cases don't match expected structure, but using them anyway")
            
            # Step 11: Store generation for fine-tuning
            from app.services.storage.ai_storage import store_ai_generation
            generation_id = await store_ai_generation(
                project_id=project_id or "default",
                prompt=prompt,
                model=model_used,
                output=json.dumps(test_cases),
                mode=model_choice.value,
                endpoint="/ai/jira-to-testcases",
                latency_ms=total_latency,
                org_id=organization_id,
                task_category=test_type
            )
            
            # Step 12: Cache the result
            response_data = {
                "test_cases": test_cases,
                "model": model_used,
                "test_type": test_type,
                "prompt_template_version": actual_template_version
            }
            
            # Cache in L1
            cache_key_final = cache_service._generate_cache_key(
                org_id=organization_id,
                prompt=normalized_req,
                model_version=model_used,
                test_type=test_type,
                project_id=project_id,
                prompt_template_version=actual_template_version
            )
            await cache_service.l1_set(cache_key_final, response_data)
            
            # Cache in L2
            await cache_service.l2_semantic_set(
                organization_id=organization_id,
                cache_key=cache_key_final,
                request_embedding=query_embedding,
                response=response_data,
                model_version=model_used,
                project_id=project_id,
                test_type=test_type,
                prompt_template_version=actual_template_version
            )
            
            total_latency = int((time.time() - start_time) * 1000)
            
            return {
                "status": "success",
                "test_cases": test_cases,
                "model": model_used,
                "latency_ms": total_latency,
                "generation_latency_ms": generation_latency,
                "cache_hit": False,
                "cache_level": None,
                "rag_context_used": rag_context is not None,
                "rag_results_count": len(rag_results) if rag_results else 0,
                "rag_similarity": rag_results[0]['similarity'] if rag_results else None,
                "source": "generation",
                "tokens_estimated": estimated_tokens,
                "generation_id": generation_id  # Include for rating/correction
            }
            
        except Exception as e:
            logger.error(f"Enhanced generation failed: {e}")
            raise
    
    async def _build_prompt(
        self,
        requirement: str,
        rag_context: Optional[str],
        test_type: str = "manual",
        organization_id: Optional[str] = None,
        project_id: Optional[str] = None,
        prompt_template_version: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Build prompt with RAG context and get template version
        
        Returns:
            Tuple of (prompt_string, template_version_string)
        """
        # Get template from service (with versioning)
        task = prompt_template_service.get_task_for_test_type(test_type)
        template, version = await prompt_template_service.get_template(
            task=task,
            organization_id=organization_id,
            project_id=project_id,
            version=prompt_template_version
        )
        
        # Use retrieved version if not specified
        if not prompt_template_version:
            prompt_template_version = version
        
        # Format template with requirement
        prompt = template.format(requirement=requirement)
        
        if rag_context:
            prompt = f"""{prompt}

CONTEXT FROM SIMILAR REQUIREMENTS:
{rag_context}

Use this context to ensure consistency with existing test cases and patterns."""
        
        return (prompt, prompt_template_version)


# Global instance
enhanced_generation_service = EnhancedGenerationService()

