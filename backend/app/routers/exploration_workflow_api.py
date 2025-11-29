"""
Complete Exploration Workflow API
Runs full workflow: Exploration → Defect Detection → Test Generation → Test Execution → Reporting
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

from app.routers.exploration_api import StartExplorationRequest
from app.services.exploration.autonomous_explorer import AutonomousExplorer, ExplorationConfig
from app.services.exploration.capability_map_builder import CapabilityMapBuilder
from app.services.exploration.test_case_generator import ExplorationTestCaseGenerator
from app.services.exploration.exploration_test_executor import ExplorationTestExecutor
from app.services.exploration.exploration_reporting import ExplorationReporting
from app.services.storage.capability_map_storage import get_capability_map_storage
from app.utils.endpoint_helpers import ensure_default_org_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exploration", tags=["exploration-workflow"])


class CompleteWorkflowRequest(BaseModel):
    """Request for complete exploration workflow."""
    base_url: str
    max_depth: int = 2
    max_pages: int = 50
    headless: bool = True
    screenshot: bool = True
    generate_tests: bool = True
    execute_tests: bool = True
    project_id: Optional[str] = None


@router.post("/complete-workflow")
async def run_complete_workflow(request: CompleteWorkflowRequest):
    """
    Run complete exploration workflow:
    1. Explore application
    2. Detect defects
    3. Generate test cases
    4. Execute tests (optional)
    5. Generate report
    """
    try:
        # Get project_id
        if not request.project_id:
            _, project_id = await ensure_default_org_project()
        else:
            project_id = request.project_id
        
        storage = get_capability_map_storage()
        
        # Step 1: Create exploration run
        config = ExplorationConfig(
            base_url=request.base_url,
            max_depth=request.max_depth,
            max_pages=request.max_pages,
            headless=request.headless,
            screenshot=request.screenshot,
            delay_between_pages=3.0,
            respect_robots_txt=True,
            wait_timeout=30000
        )
        
        run_id = await storage.create_exploration_run(
            project_id=project_id,
            base_url=request.base_url,
            config=config.__dict__
        )
        
        # Step 2: Run exploration
        explorer = AutonomousExplorer(config)
        exploration_result = await explorer.explore()
        
        # Update exploration run
        await storage.update_exploration_run(
            run_id=run_id,
            status='completed',
            total_pages=exploration_result.get('total_pages', 0)
        )
        
        # Step 3: Build capability map
        builder = CapabilityMapBuilder()
        capability_map = await builder.build_capability_map(exploration_result)
        
        # Preserve LLM analysis from exploration_result if it exists
        # (exploration_result is the capability_map returned by explorer.explore())
        if isinstance(exploration_result, dict):
            if 'llm_analysis' in exploration_result:
                capability_map['llm_analysis'] = exploration_result['llm_analysis']
                logger.info("Preserved llm_analysis in capability map")
            if 'initial_analysis' in exploration_result:
                capability_map['initial_analysis'] = exploration_result['initial_analysis']
                logger.info("Preserved initial_analysis in capability map")
        
        # Save capability map
        map_id = await storage.save_capability_map(
            exploration_run_id=run_id,
            project_id=project_id,
            base_url=request.base_url,
            capability_data=capability_map
        )
        
        # Step 4: Save defects
        from app.services.exploration.defect_storage import DefectStorage
        defect_storage = DefectStorage()
        defects_saved = 0
        
        if exploration_result.get('defects'):
            from app.services.exploration.defect_detector_sync import Defect
            defects = []
            for defect_data in exploration_result.get('defects', []):
                try:
                    defect = Defect(**defect_data)
                    defects.append(defect)
                except:
                    pass
            
            if defects:
                defect_ids = await defect_storage.save_defects_batch(
                    defects,
                    exploration_run_id=run_id,
                    capability_map_id=map_id,
                    project_id=project_id
                )
                defects_saved = len(defect_ids)
        
        # Step 5: Generate test cases (with LLM flow generation if available)
        test_cases_generated = []
        if request.generate_tests:
            # Check if LLM analysis is available
            llm_analysis = capability_map.get('llm_analysis')
            if llm_analysis and llm_analysis.get('critical_flows'):
                # Use LLM to generate flows, then convert to test cases
                try:
                    from app.services.exploration.llm_application_analyzer import LLMApplicationAnalyzer
                    from app.services.exploration.domain_specific_flow_generator import DomainSpecificFlowGenerator
                    from app.services.exploration.application_analyzer import ApplicationContext
                    from app.services.exploration.synthetic_data_generator import SyntheticDataGenerator
                    
                    llm_analyzer = LLMApplicationAnalyzer()
                    
                    # Generate flows using LLM
                    llm_flows = []
                    for critical_flow in llm_analysis.get('critical_flows', [])[:5]:  # Limit to 5 flows
                        try:
                            flow = await llm_analyzer.generate_flow(
                                flow_definition=critical_flow,
                                pages=exploration_result.get('pages', []),
                                forms=exploration_result.get('forms', []),
                                domain=llm_analysis.get('domain', 'generic'),
                                application_type=llm_analysis.get('application_type', 'web_application')
                            )
                            llm_flows.append(flow)
                        except Exception as e:
                            logger.warning(f"Failed to generate LLM flow {critical_flow.get('name')}: {e}")
                    
                    # Convert LLM flows to test cases
                    if llm_flows:
                        for flow in llm_flows:
                            test_case = {
                                'title': flow.get('flow_name', 'Unknown Flow'),
                                'description': flow.get('description', ''),
                                'test_type': 'functional',
                                'priority': flow.get('priority', 'medium'),
                                'steps': [
                                    {
                                        'step_number': step.get('step_number', i+1),
                                        'action': step.get('action', ''),
                                        'expected_result': step.get('expected_result', ''),
                                        'element_name': step.get('target', ''),
                                        'selector': None,
                                        'test_data': step.get('test_data')
                                    }
                                    for i, step in enumerate(flow.get('steps', []))
                                ],
                                'entity': flow.get('domain', ''),
                                'operation': flow.get('flow_name', ''),
                                'test_data': flow.get('test_data_template', {})
                            }
                            test_cases_generated.append(test_case)
                        
                        logger.info(f"Generated {len(test_cases_generated)} test cases from LLM flows")
                    
                except Exception as e:
                    logger.warning(f"LLM flow generation failed: {e}, falling back to standard generator")
            
            # Fallback to standard test case generator
            if not test_cases_generated:
                test_generator = ExplorationTestCaseGenerator()
                test_cases_generated = await test_generator.generate_from_capability_map(capability_map)
                logger.info(f"Generated {len(test_cases_generated)} test cases using standard generator")
        
        # Step 6: Execute tests (optional)
        test_execution_results = None
        if request.execute_tests and test_cases_generated:
            test_executor = ExplorationTestExecutor()
            test_execution_results = await test_executor.execute_test_suite(
                test_cases_generated,
                capability_map,
                exploration_run_id=run_id,
                capability_map_id=map_id,
                project_id=project_id
            )
            logger.info(f"Executed {test_execution_results.get('total', 0)} tests")
        
        # Step 7: Generate report
        reporting = ExplorationReporting()
        report = await reporting.generate_exploration_report(run_id, project_id)
        
        # Convert test cases to dict format for response
        test_cases_data = []
        for tc in test_cases_generated:
            # Handle both dict and object formats
            if isinstance(tc, dict):
                test_cases_data.append(tc)
            else:
                test_cases_data.append({
                    'title': getattr(tc, 'title', ''),
                    'description': getattr(tc, 'description', ''),
                    'test_type': getattr(tc, 'test_type', 'functional'),
                    'priority': getattr(tc, 'priority', 'medium'),
                    'steps': getattr(tc, 'steps', []),
                    'expected_result': getattr(tc, 'expected_result', ''),
                    'entity': getattr(tc, 'entity', ''),
                    'operation': getattr(tc, 'operation', ''),
                    'test_data': getattr(tc, 'test_data', {}),
                    'tags': getattr(tc, 'tags', [])
                })
        
        # Format defects for response
        defects_data = []
        for i, d in enumerate(exploration_result.get('defects', [])):
            # Handle both dict and object formats
            if isinstance(d, dict):
                defects_data.append({
                    'id': d.get('id', f"temp_{i}"),
                    'title': d.get('title', 'Unknown Defect'),
                    'description': d.get('description', ''),
                    'defect_type': d.get('defect_type', 'functional'),
                    'severity': d.get('severity', d.get('priority', 'medium')),
                    'status': d.get('status', 'open'),
                    'page_url': d.get('page_url', ''),
                    'detected_at': d.get('detected_at', datetime.utcnow().isoformat()),
                    'screenshot_path': d.get('screenshot_path')
                })
            else:
                defects_data.append({
                    'id': getattr(d, 'id', f"temp_{i}"),
                    'title': getattr(d, 'title', 'Unknown Defect'),
                    'description': getattr(d, 'description', ''),
                    'defect_type': getattr(d, 'defect_type', 'functional'),
                    'severity': getattr(d, 'severity', getattr(d, 'priority', 'medium')),
                    'status': getattr(d, 'status', 'open'),
                    'page_url': getattr(d, 'page_url', ''),
                    'detected_at': getattr(d, 'detected_at', datetime.utcnow().isoformat()),
                    'screenshot_path': getattr(d, 'screenshot_path', None)
                })
        
        return {
            "status": "success",
            "exploration_run_id": run_id,
            "capability_map_id": map_id,
            "summary": {
                "pages_discovered": exploration_result.get('total_pages', 0),
                "defects_detected": len(exploration_result.get('defects', [])),
                "defects_saved": defects_saved,
                "test_cases_generated": len(test_cases_generated),
                "test_cases_executed": test_execution_results.get('total', 0) if test_execution_results else 0,
                "test_cases_passed": test_execution_results.get('passed', 0) if test_execution_results else 0,
                "test_cases_failed": test_execution_results.get('failed', 0) if test_execution_results else 0,
                "defects_from_tests": test_execution_results.get('defects_created', 0) if test_execution_results else 0
            },
            "test_cases": test_cases_data,  # Include test cases in response
            "defects": defects_data,  # Include defects from exploration
            "report": report,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Complete workflow failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Workflow failed: {str(e)}"
        )

