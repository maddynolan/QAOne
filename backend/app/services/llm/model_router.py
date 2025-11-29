"""
Model Router - Intelligent routing between 7B and 14B models
Decides which model to use based on prompt complexity and RAG results
"""

import logging
import os
from typing import List, Dict, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)

class ModelChoice(str, Enum):
    """Model selection choices"""
    QUICK = "quick"  # 7B model - fast, cheaper
    UI = "ui"  # 14B model - deeper reasoning
    HEAVY = "heavy"  # 32B model - maximum capability

class ModelRouter:
    """Intelligent model routing based on prompt and context"""
    
    def __init__(self):
        # Configuration
        self.quick_token_threshold = int(os.getenv("QUICK_MODEL_TOKEN_THRESHOLD", "9000"))  # 9k tokens
        self.min_rag_snippets = int(os.getenv("MIN_RAG_SNIPPETS_FOR_QUICK", "4"))  # Need 4+ good snippets
        self.low_similarity_threshold = float(os.getenv("LOW_SIMILARITY_THRESHOLD", "0.80"))  # <0.80 = use 14B
        self.security_keywords = [
            "security", "authentication", "authorization", "encryption",
            "password", "token", "credential", "permission", "access control",
            "compliance", "gdpr", "pii", "sensitive data"
        ]
        self.multi_module_keywords = [
            "integration", "api", "microservice", "distributed",
            "end-to-end", "e2e", "cross-module", "system"
        ]
    
    def choose_model(
        self,
        prompt: str,
        rag_results: Optional[List[Dict[str, Any]]] = None,
        user_override: Optional[str] = None,
        test_type: Optional[str] = None
    ) -> ModelChoice:
        """
        Choose model based on prompt complexity and RAG context
        
        Args:
            prompt: User prompt
            rag_results: RAG retrieval results (similar requirements)
            user_override: User's manual selection ('quick' or 'deep')
            test_type: Type of test ('manual', 'automated', 'api', etc.)
            
        Returns:
            ModelChoice enum
        """
        # User override takes priority
        if user_override:
            if user_override.lower() in ['quick', 'fast', '7b']:
                return ModelChoice.QUICK
            elif user_override.lower() in ['deep', 'thorough', '14b', 'ui']:
                return ModelChoice.UI
            elif user_override.lower() in ['heavy', '32b']:
                return ModelChoice.HEAVY
        
        # Estimate prompt tokens (rough: 1 token ≈ 4 characters)
        prompt_tokens = len(prompt) // 4
        
        # Check for security/compliance keywords
        prompt_lower = prompt.lower()
        has_security = any(keyword in prompt_lower for keyword in self.security_keywords)
        has_multi_module = any(keyword in prompt_lower for keyword in self.multi_module_keywords)
        
        # Check RAG results
        rag_count = len(rag_results) if rag_results else 0
        rag_quality = self._assess_rag_quality(rag_results) if rag_results else False
        
        # Decision logic
        # Use 14B if:
        # 1. Prompt is very long (>9k tokens)
        # 2. Low RAG similarity (<0.80)
        # 3. Security/compliance keywords
        # 4. Multi-module/integration
        # 5. Test type is 'api' or 'security'
        if (
            prompt_tokens > self.quick_token_threshold or
            (rag_results and not rag_quality) or
            has_security or
            has_multi_module or
            test_type in ['api', 'security', 'performance']
        ):
            logger.info(f"Routing to 14B: tokens={prompt_tokens}, security={has_security}, multi_module={has_multi_module}, test_type={test_type}")
            return ModelChoice.UI
        
        # Use 7B if:
        # 1. Prompt is short-medium (<9k tokens)
        # 2. RAG found good snippets (4+ with similarity >0.80)
        # 3. No security/compliance concerns
        # 4. Simple test type
        if (
            prompt_tokens <= self.quick_token_threshold and
            rag_count >= self.min_rag_snippets and
            rag_quality and
            not has_security and
            not has_multi_module
        ):
            logger.info(f"Routing to 7B: tokens={prompt_tokens}, rag_count={rag_count}, rag_quality={rag_quality}")
            return ModelChoice.QUICK
        
        # Default to 14B for safety
        logger.info(f"Defaulting to 14B: tokens={prompt_tokens}, rag_count={rag_count}")
        return ModelChoice.UI
    
    def _assess_rag_quality(self, rag_results: List[Dict[str, Any]]) -> bool:
        """
        Assess if RAG results are high quality
        
        Args:
            rag_results: RAG retrieval results
            
        Returns:
            True if RAG quality is good (enough snippets with good similarity)
        """
        if not rag_results:
            return False
        
        # Check if we have enough results
        if len(rag_results) < self.min_rag_snippets:
            return False
        
        # Check average similarity
        avg_similarity = sum(r.get('similarity', 0) for r in rag_results) / len(rag_results)
        
        # Consider good if avg similarity > 0.80
        return avg_similarity >= self.low_similarity_threshold
    
    def get_model_info(self, choice: ModelChoice) -> Dict[str, Any]:
        """Get information about model choice"""
        # Check if trained model is enabled for QUICK mode
        # Default to false since fine-tuned model (qa-expert:7b) was deleted
        use_finetuned = os.getenv("USE_FINETUNED_MODEL", "false").lower() == "true"
        # Default to qwen3-coder:30b since old models deleted
        finetuned_model = os.getenv("FINETUNED_MODEL_NAME", "qwen3-coder:30b")
        
        # Use trained model for QUICK if enabled, otherwise use qwen3-coder:30b
        quick_model = finetuned_model if use_finetuned else 'qwen3-coder:30b'
        print(f"[INFO] MODEL_ROUTER.get_model_info - QUICK model: {quick_model} (use_finetuned: {use_finetuned})")
        logger.info(f"QUICK model: {quick_model} (use_finetuned: {use_finetuned})")
        
        model_map = {
            ModelChoice.QUICK: {
                'model': quick_model,
                'estimated_latency': '5-10s',
                'cost': 'low',
                'use_case': 'Simple prompts with good RAG context'
            },
            ModelChoice.UI: {
                'model': 'qwen2.5-coder:14b',
                'estimated_latency': '15-25s',
                'cost': 'medium',
                'use_case': 'Complex prompts, security, integrations'
            },
            ModelChoice.HEAVY: {
                'model': 'qwen2.5-coder:32b',
                'estimated_latency': '30-60s',
                'cost': 'high',
                'use_case': 'Maximum quality, complex reasoning'
            }
        }
        
        return model_map.get(choice, model_map[ModelChoice.UI])


# Global instance
model_router = ModelRouter()

