"""
Test Management Module Routers

Test cases, plans, runs, automation, and verifications.
Core CRUD for test lifecycle management with execution,
Gherkin/BDD support, and complex verification capabilities.

Routers:
- test_case_api: /test-cases/* - Legacy test case endpoints
- test_cases_crud_api: /test-cases/* - Test case CRUD (16 endpoints)
- test_case_rewrite_api: /test-cases/rewrite/* - AI test case rewriting
- test_runs_api: /test-runs/* - Test run execution and reporting (14 endpoints)
- test_plans_api: /test-plans/* - Test plan management (4 endpoints)
- gherkin_api: /api/gherkin/* - BDD/Gherkin support (3 endpoints)
- automation_api: /automation/* - Script conversion, execution
- requirement_to_testcase_api: /api/req2tc/* - Requirement-to-test-case conversion
- workflows_api: /api/workflows/* - Test workflow management
- complex_verifications: /api/complex-verify/* - Email/PDF/file verification (10 endpoints)
- sample_data_api: /api/sample-data/* - Sample data generation
"""
from .test_case_api import router as test_case_router
from .test_cases_crud_api import router as test_cases_crud_router
from .test_case_rewrite_api import router as test_case_rewrite_router
from .test_runs_api import router as test_runs_router
from .test_plans_api import router as test_plans_router
from .gherkin_api import router as gherkin_router
from .automation_api import router as automation_router
from .requirement_to_testcase_api import router as requirement_to_testcase_router
from .workflows_api import router as workflows_router
from .complex_verifications import router as complex_verifications_router
from .sample_data_api import router as sample_data_router
