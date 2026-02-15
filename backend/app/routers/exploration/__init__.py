"""
Exploration Module Routers

Autonomous application exploration, AI-driven test generation from
exploration sessions, reporting, and workflow management. Includes
Nexus exploratory testing and Blaze rapid test generation agents.

Routers:
- exploration_api: /api/exploration/* - Core autonomous app exploration
- exploration_test_generation_api: /api/exploration/tests/* - Test generation from exploration
- exploration_reporting_api: /api/exploration/reports/* - Exploration session reporting
- exploration_workflow_api: /api/exploration/workflows/* - Exploration workflow management
- nexus_exploratory_api: /api/nexus/* - Nexus exploratory testing agent
- blaze_api: /api/blaze/* - Blaze rapid test generation agent
"""
from .exploration_api import router as exploration_router
from .exploration_test_generation_api import router as exploration_test_generation_router
from .exploration_reporting_api import router as exploration_reporting_router
from .exploration_workflow_api import router as exploration_workflow_router
from .nexus_exploratory_api import router as nexus_exploratory_router
from .blaze_api import router as blaze_router
