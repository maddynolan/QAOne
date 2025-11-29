# Refactoring Plan: Requirement-to-TestCase Pipeline

## Current Issues

1. **Variation Logic Scattered**
   - Variation generation in `requirement_scenario_generator.py`
   - Variation detection in `test_case_rewrite_service.py`
   - Variation markers in `requirement_to_testcase_api.py`
   - Hard to maintain and extend

2. **Deduplication in Wrong Place**
   - Deduplication logic is in the API router (`requirement_to_testcase_api.py`)
   - Should be a reusable service
   - Makes testing difficult

3. **Complex Prompt Building**
   - Variation hints built in multiple places
   - Hard to maintain consistency
   - Difficult to add new variation types

4. **Mixed Responsibilities**
   - API router doing business logic
   - Scenario generator doing variation detection
   - LLM service doing variation detection

## Proposed Refactoring

### 1. Extract `VariationGenerator` Service
**File**: `backend/app/services/engines/variation_generator.py`

**Responsibilities**:
- Detect variations from acceptance criteria
- Generate variation scenario skeletons
- Track generated variations to avoid duplicates
- Create explicit variation titles and steps

**Methods**:
- `detect_variations(acceptance_criteria: List[str]) -> List[Variation]`
- `generate_variation_scenarios(context, app_model, variations) -> List[ScenarioSkeleton]`
- `create_variation_marker(variation_type, value) -> str`

### 2. Extract `TestCaseDeduplicationService`
**File**: `backend/app/services/engines/test_case_deduplication_service.py`

**Responsibilities**:
- Deduplicate similar test cases
- Calculate similarity scores
- Choose best test case from groups
- Configurable similarity threshold

**Methods**:
- `deduplicate(test_cases: List[TestCase], threshold: float = 0.85) -> List[TestCase]`
- `calculate_similarity(tc1: TestCase, tc2: TestCase) -> float`
- `create_signature(test_case: TestCase) -> str`
- `choose_best(group: List[TestCase]) -> TestCase`

### 3. Create `VariationMarker` Utility
**File**: `backend/app/utils/variation_marker.py`

**Responsibilities**:
- Encode variation information in high_level_intent
- Decode variation information from high_level_intent
- Standardize variation marker format

**Methods**:
- `encode_variations(skeleton: ScenarioSkeleton) -> str`
- `decode_variations(high_level_intent: str) -> Dict[str, Any]`
- `extract_variation_hints(high_level_intent: str) -> List[str]`

### 4. Simplify `PromptBuilder` in LLM Service
**File**: `backend/app/services/llm/test_case_rewrite_service.py`

**Changes**:
- Use `VariationMarker` utility instead of custom logic
- Simplify variation hint generation
- Cleaner separation of concerns

### 5. Refactor API Router
**File**: `backend/app/routers/requirement_to_testcase_api.py`

**Changes**:
- Remove deduplication logic (use service)
- Remove variation marker logic (use utility)
- Focus on orchestration only
- Cleaner, more maintainable

## Benefits

1. **Better Separation of Concerns**
   - Each class has a single responsibility
   - Easier to test individual components
   - Easier to extend with new variation types

2. **Improved Maintainability**
   - Variation logic in one place
   - Deduplication logic in one place
   - Clear interfaces between components

3. **Easier Testing**
   - Can test variation generation independently
   - Can test deduplication independently
   - Can mock services easily

4. **Easier Extension**
   - Add new variation types by extending `VariationGenerator`
   - Adjust deduplication by modifying threshold/config
   - Add new variation markers without touching multiple files

## Migration Strategy

1. **Phase 1**: Create new services (non-breaking)
   - Create `VariationGenerator` service
   - Create `TestCaseDeduplicationService`
   - Create `VariationMarker` utility

2. **Phase 2**: Refactor existing code
   - Update `requirement_scenario_generator.py` to use `VariationGenerator`
   - Update `requirement_to_testcase_api.py` to use `TestCaseDeduplicationService`
   - Update `test_case_rewrite_service.py` to use `VariationMarker`

3. **Phase 3**: Clean up
   - Remove duplicate code
   - Update tests
   - Update documentation

## Risk Assessment

**Low Risk**:
- Creating new services doesn't break existing code
- Can be done incrementally
- Can test new services independently

**Medium Risk**:
- Refactoring existing code might introduce bugs
- Need thorough testing after refactoring
- May need to adjust thresholds/logic

**Mitigation**:
- Keep old code until new code is tested
- Add comprehensive logging
- Test with same requirements to compare outputs

## Recommendation

**YES, proceed with refactoring** because:
- Code is getting complex and hard to maintain
- System is working, so we have a stable baseline
- Refactoring will make future improvements easier
- Can be done incrementally to minimize risk
