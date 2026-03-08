"""
FastAPI router for requirement-to-test-case generation
Implements the full flow: Jira → Requirement Context → Synthetic App Model → Scenario Skeletons → LLM Rewrite → Test Cases
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.schemas.requirement_schemas import (
    RequirementContext,
    SyntheticAppModel,
    ScenarioSkeleton,
    TestCase,
    TestCaseStep
)
from app.services.engines.requirement_context_builder import RequirementContextBuilder
from app.services.engines.synthetic_app_model_generator import SyntheticAppModelGenerator
from app.services.engines.requirement_scenario_generator import RequirementScenarioGenerator
from app.services.engines.test_case_deduplication_service import TestCaseDeduplicationService
from app.services.llm.test_case_rewrite_service import TestCaseRewriteService, RewriteRequest, ScenarioSkeleton as RewriteSkeleton, RawStep
from app.utils.variation_marker import VariationMarker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/requirements", tags=["requirement-to-testcase"])


class JiraStoryInput(BaseModel):
    """Input for Jira story to test case generation"""
    requirement_id: str  # Jira key, e.g., "PAY-210"
    title: str
    description: str
    acceptance_criteria: Optional[List[str]] = None
    raw_payload: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


class RequirementContextInput(BaseModel):
    """Input for requirement context (if already built)"""
    requirement_context: Dict[str, Any]  # RequirementContext as dict


@router.post("/jira-to-testcases")
async def jira_to_testcases(
    request: JiraStoryInput
):
    """
    Full flow: Jira story → Requirement Context → Synthetic App Model → Scenario Skeletons → LLM Rewrite → Test Cases
    
    This implements the complete requirement-to-test-case pipeline.
    """
    try:
        # Step 1: Build Requirement Context
        logger.info(f"[STEP 1] Building requirement context for {request.requirement_id}")
        context_builder = RequirementContextBuilder()
        requirement_context = await context_builder.build_context(
            requirement_id=request.requirement_id,
            title=request.title,
            description=request.description,
            acceptance_criteria=request.acceptance_criteria,
            raw_payload=request.raw_payload
        )
        logger.info(f"[OK] Requirement context built: type={requirement_context.type}, entities={len(requirement_context.entities or [])}")
        
        # Step 2: Generate Synthetic App Model
        logger.info(f"[STEP 2] Generating synthetic app model for {request.requirement_id}")
        app_model_generator = SyntheticAppModelGenerator()
        app_model = await app_model_generator.generate_app_model(requirement_context)
        logger.info(f"[OK] Synthetic app model generated: {len(app_model.screens)} screens, {len(app_model.apis)} APIs")
        
        # Step 3: Generate Scenario Skeletons (Deterministic)
        logger.info(f"[STEP 3] Generating scenario skeletons for {request.requirement_id}")
        scenario_generator = RequirementScenarioGenerator()
        scenario_skeletons = scenario_generator.generate_scenarios(requirement_context, app_model)
        logger.info(f"[OK] Generated {len(scenario_skeletons)} scenario skeletons")
        
        # Step 4: LLM Rewrite each scenario skeleton
        logger.info(f"[STEP 4] Rewriting scenarios with LLM for {request.requirement_id}")
        rewrite_service = TestCaseRewriteService()
        test_cases = []
        
        for skeleton in scenario_skeletons:
            try:
                # Convert ScenarioSkeleton to RewriteSkeleton format
                raw_steps = []
                for i, step_text in enumerate(skeleton.steps, 1):
                    raw_steps.append(RawStep(
                        order=i,
                        event_type="action",
                        element_text=None,
                        selector=None,
                        field_role=None
                    ))
                
                # Encode variation information using VariationMarker utility
                high_level_intent = VariationMarker.encode_variations(skeleton)
                
                rewrite_skeleton = RewriteSkeleton(
                    scenario_id=skeleton.id,
                    scenario_type="functional",
                    high_level_intent=high_level_intent,
                    raw_steps=raw_steps
                )
                
                rewrite_request = RewriteRequest(
                    project_name=request.project_id,
                    application_name=requirement_context.domain_area,
                    skeleton=rewrite_skeleton
                )
                
                # Rewrite with LLM - pass requirement context for better test case generation
                # SEC-TIMEOUT-001: 60-second timeout to prevent runaway LLM calls
                try:
                    rewritten = await asyncio.wait_for(
                        rewrite_service.rewrite_test_case(
                            rewrite_request,
                            requirement_context=requirement_context.dict()
                        ),
                        timeout=60.0
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"[TIMEOUT] LLM rewrite timed out for scenario {skeleton.id} after 60s")
                    continue  # Skip this scenario, continue with others
                
                # Convert to TestCase format
                test_case = TestCase(
                    id=skeleton.id,
                    requirement_id=skeleton.requirement_id,
                    title=rewritten.title,
                    objective=rewritten.description,
                    kind=skeleton.kind,
                    preconditions=skeleton.preconditions,
                    steps=[
                        TestCaseStep(
                            step_number=step.step_number,
                            action=step.action,
                            expected_result=step.expected_result,
                            screen_id=None,
                            target_id=None,
                            data={}
                        )
                        for step in rewritten.steps
                    ],
                    expected_result_summary=", ".join(skeleton.expected_result),
                    priority=skeleton.priority,
                    tags=skeleton.tags,
                    metadata={
                        "generation_metrics": rewritten.generation_metrics
                    }
                )
                
                test_cases.append(test_case)
                logger.info(f"[OK] Rewrote scenario {skeleton.id} -> '{test_case.title}'")
                
            except Exception as e:
                logger.error(f"[ERROR] Failed to rewrite scenario {skeleton.id}: {e}", exc_info=True)
                # Continue with other scenarios
        
        logger.info(f"[OK] Generated {len(test_cases)} test cases from {len(scenario_skeletons)} skeletons")
        
        # Log before deduplication
        logger.info(f"[BEFORE DEDUP] {len(test_cases)} test cases with titles: {[tc.title for tc in test_cases]}")
        
        # Deduplicate similar test cases using service
        deduplication_service = TestCaseDeduplicationService(similarity_threshold=0.85)
        test_cases = deduplication_service.deduplicate(test_cases)
        logger.info(f"[AFTER DEDUP] {len(test_cases)} unique test cases with titles: {[tc.title for tc in test_cases]}")
        
        return {
            "status": "success",
            "requirement_id": request.requirement_id,
            "requirement_context": requirement_context.dict(),
            "synthetic_app_model": app_model.dict(),
            "scenario_skeletons": [s.dict() for s in scenario_skeletons],
            "test_cases": [tc.dict() for tc in test_cases],
            "summary": {
                "total_scenarios": len(scenario_skeletons),
                "total_test_cases": len(test_cases),
                "screens_generated": len(app_model.screens),
                "apis_generated": len(app_model.apis)
            }
        }
        
    except asyncio.TimeoutError:
        logger.error(f"[TIMEOUT] Full requirement-to-testcase pipeline timed out for {request.requirement_id}")
        raise HTTPException(
            status_code=504,
            detail="Test case generation timed out. Please try with a simpler requirement or retry later."
        )
    except Exception as e:
        logger.error(f"Failed to generate test cases from Jira story: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate test cases"
        )


@router.post("/generate-skeletons")
async def generate_skeletons(
    request: RequirementContextInput
):
    """
    Generate scenario skeletons from requirement context (Step 3 only).
    Returns deterministic skeletons before LLM rewrite.
    """
    try:
        requirement_context = RequirementContext(**request.requirement_context)
        
        # Generate synthetic app model
        app_model_generator = SyntheticAppModelGenerator()
        app_model = await app_model_generator.generate_app_model(requirement_context)
        
        # Generate scenario skeletons
        scenario_generator = RequirementScenarioGenerator()
        scenario_skeletons = scenario_generator.generate_scenarios(requirement_context, app_model)
        
        return {
            "status": "success",
            "requirement_id": requirement_context.requirement_id,
            "synthetic_app_model": app_model.dict(),
            "scenario_skeletons": [s.dict() for s in scenario_skeletons]
        }
        
    except Exception as e:
        logger.error(f"Failed to generate scenario skeletons: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate scenario skeletons"
        )


# Deduplication logic moved to TestCaseDeduplicationService
def _deduplicate_test_cases_OLD(test_cases: List[TestCase]) -> List[TestCase]:
    """
    Deduplicate test cases by comparing titles and step sequences.
    Keeps the most complete test case from each group of similar ones.
    """
    if len(test_cases) <= 1:
        return test_cases
    
    # Group test cases by similarity
    groups = []
    used_indices = set()
    
    for i, test_case in enumerate(test_cases):
        if i in used_indices:
            continue
        
        # Create signature for this test case
        signature = _create_test_case_signature(test_case)
        
        # Find similar test cases
        similar_group = [test_case]
        used_indices.add(i)
        
        for j, other_case in enumerate(test_cases[i+1:], start=i+1):
            if j in used_indices:
                continue
            
            other_signature = _create_test_case_signature(other_case)
            similarity = _calculate_similarity(signature, other_signature)
            
            # Consider similar if > 85% similarity (more lenient to keep distinct variations)
            if similarity > 0.85:
                similar_group.append(other_case)
                used_indices.add(j)
        
        groups.append(similar_group)
    
    # Keep one from each group (prefer higher priority or more complete)
    deduplicated = []
    for group in groups:
        if len(group) == 1:
            deduplicated.append(group[0])
        else:
            # Choose best test case from group
            best = _choose_best_from_group(group)
            deduplicated.append(best)
            logger.info(f"Deduplicated {len(group)} similar test cases, kept: '{best.title}'")
    
    return deduplicated


def _create_test_case_signature(test_case: TestCase) -> str:
    """Create a signature for a test case based on title and key steps"""
    # Normalize title
    title_lower = test_case.title.lower()
    
    # Extract key words from title - be more specific to distinguish variations
    key_words = []
    
    # Payee variations
    if "new payee" in title_lower or ("add" in title_lower and "payee" in title_lower):
        key_words.append("add_payee")
    elif "saved payee" in title_lower:
        key_words.append("saved_payee")
    
    # Frequency variations - these should be distinct
    if "quarterly" in title_lower:
        key_words.append("freq_quarterly")
    elif "yearly" in title_lower:
        key_words.append("freq_yearly")
    elif "monthly" in title_lower and "not monthly" not in title_lower:
        key_words.append("freq_monthly")
    
    # End date variations
    if "specific end date" in title_lower or ("end date" in title_lower and "until cancelled" not in title_lower and "specific" in title_lower):
        key_words.append("end_date_specific")
    elif "until cancelled" in title_lower:
        key_words.append("end_date_until_cancelled")
    
    # Test type
    kind_str = str(test_case.kind).lower() if test_case.kind else ""
    if "validation" in kind_str or "validation" in title_lower:
        key_words.append("type_validation")
    elif "management" in kind_str or "management" in title_lower:
        key_words.append("type_management")
    elif "variation" in kind_str or "variation" in title_lower:
        key_words.append("type_variation")
    elif "happy" in kind_str or "happy" in title_lower:
        key_words.append("type_happy_path")
    
    # Extract first few step actions - look for variation indicators
    step_actions = []
    for step in test_case.steps[:8]:  # First 8 steps to catch variations
        action_lower = step.action.lower()
        if "add new" in action_lower or ("new payee" in action_lower and "add" in action_lower):
            step_actions.append("step_add_payee")
        elif "frequency" in action_lower or "set.*frequency" in action_lower:
            if "quarterly" in action_lower or ("not" in action_lower and "monthly" in action_lower):
                step_actions.append("step_freq_quarterly")
            elif "yearly" in action_lower:
                step_actions.append("step_freq_yearly")
            elif "monthly" in action_lower:
                step_actions.append("step_freq_monthly")
        elif "end date" in action_lower:
            if "specific" in action_lower or ("not" in action_lower and "until cancelled" in action_lower):
                step_actions.append("step_end_date_specific")
            elif "until cancelled" in action_lower:
                step_actions.append("step_end_date_until_cancelled")
    
    # Combine key words and step actions - variations should have distinct signatures
    signature = f"{':'.join(sorted(set(key_words)))}:{':'.join(sorted(set(step_actions)))}"
    return signature


def _calculate_similarity(sig1: str, sig2: str) -> float:
    """Calculate similarity between two signatures (0.0 to 1.0)"""
    if not sig1 or not sig2:
        return 0.0
    
    # Split signatures
    parts1 = set(sig1.split(':'))
    parts2 = set(sig2.split(':'))
    
    if not parts1 or not parts2:
        return 0.0
    
    # Calculate Jaccard similarity
    intersection = len(parts1 & parts2)
    union = len(parts1 | parts2)
    
    if union == 0:
        return 0.0
    
    return intersection / union


def _choose_best_from_group(group: List[TestCase]) -> TestCase:
    """Choose the best test case from a group of similar ones"""
    if len(group) == 1:
        return group[0]
    
    # Prefer test cases with:
    # 1. More specific titles (longer, more descriptive)
    # 2. More steps (more complete)
    # 3. Higher priority
    # 4. Variation type (more specific)
    
    def score(tc: TestCase) -> float:
        score = 0.0
        
        # Title specificity (longer = more specific)
        score += len(tc.title) * 0.01
        
        # Number of steps (more = more complete)
        score += len(tc.steps) * 0.1
        
        # Priority (high > medium > low)
        priority_scores = {"high": 3, "medium": 2, "low": 1}
        priority_str = tc.priority.value.lower() if hasattr(tc.priority, 'value') else str(tc.priority).lower()
        score += priority_scores.get(priority_str, 1)
        
        # Variation type bonus (more specific)
        kind_str = str(tc.kind).lower() if tc.kind else ""
        if "variation" in kind_str:
            score += 0.5
        if any("quarterly" in tag.lower() or "yearly" in tag.lower() or "end date" in tag.lower() 
               for tag in (tc.tags or [])):
            score += 1.0
        
        return score
    
    return max(group, key=score)

