"""
Prompt builders for Task 1 (Requirement → Test Plan) and Task 2 (Requirement → Tests + Code)
"""

from app.schemas import ReqToTestPlanInput, ReqToTestsInput


def build_req_to_testplan_prompt(inp: ReqToTestPlanInput) -> str:
    """Build prompt for Task 1: Requirement → Test Plan"""
    # TODO: you'll replace this with your program-of-thought template
    prompt = f"""You are an expert QA test planner. Generate a structured test plan in JSON format.

Requirement ID: {inp.requirement_id}
Title: {inp.requirement_title or 'N/A'}
Requirement: {inp.requirement_text}
Acceptance criteria:
{chr(10).join(inp.acceptance_criteria or [])}
Domain tags: {", ".join(inp.domain_tags or [])}
Risk: {inp.risk_level}
Non-functional focus: {", ".join(inp.non_functional_focus or [])}

Return JSON with keys: test_plan_id, summary, scenarios, coverage_summary.

Each scenario must include:
- scenario_id, name, description
- type (functional/non_functional/edge_case/negative)
- test_types (ui/api/performance/accessibility/security)
- priority (P0/P1/P2/P3)
- is_positive, preconditions, postconditions
- data_sets (optional), tags (optional)

Coverage summary must include boolean flags:
- happy_path_covered, negative_paths_covered, edge_cases_covered
- performance_covered, accessibility_covered, security_covered
"""
    return prompt


def build_req_to_tests_prompt(inp: ReqToTestsInput) -> str:
    """Build prompt for Task 2: Requirement → Tests + Code"""
    # Again, you'll turn this into a strict, grammar-driven template Later
    base = f"""You are an expert test automation engineer. Generate concrete tests and code across UI, API, performance, accessibility, and security (where applicable) for the following requirement.

Use the given test plan as grounding if provided.

Requirement ID: {inp.requirement_id}
Title: {inp.requirement_title or 'N/A'}
Requirement: {inp.requirement_text}
Acceptance criteria:
{chr(10).join(inp.acceptance_criteria or [])}
Domain tags: {", ".join(inp.domain_tags or [])}
"""
    
    if inp.test_plan:
        base += f"\nExisting test plan (JSON):\n{inp.test_plan.model_dump_json(indent=2)}\n"
    
    if inp.target_frameworks:
        base += f"Target frameworks: {', '.join(inp.target_frameworks)}\n"
    
    base += """
Return JSON with a 'tests' array.

Each test must include:
- id, name, description
- linked_scenario_id (if from test plan)
- test_type (ui/api/performance/accessibility/security)
- framework (playwright/cypress/pytest-api/k6/axe/lighthouse/zap)
- language (typescript/javascript/python/go/yaml/other)
- tags, steps (with index, action, expected_result, notes)
- assertions, preconditions, postconditions
- code (full code snippet)
- additional_files (optional, e.g. k6 config, ZAP policy)
"""
    
    return base


