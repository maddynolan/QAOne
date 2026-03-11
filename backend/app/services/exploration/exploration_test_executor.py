# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the Autonomous Explorer / Flowmap system which is unused.
"""
Exploration Test Executor
Executes all generated test cases from capability map and creates defects from failures.
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.exploration.test_case_generator import GeneratedTestCase
from app.services.automation.test_execution_service import TestExecutionService
from app.services.exploration.defect_storage import DefectStorage
from app.services.llm.playwright_code_service import PlaywrightCodeService

logger = logging.getLogger(__name__)


class ExplorationTestExecutor:
    """
    Executes test cases generated from capability map.
    Auto-creates defects from test failures.
    """
    
    def __init__(self):
        self.test_execution_service = TestExecutionService()
        self.defect_storage = DefectStorage()
        self.playwright_code_service = PlaywrightCodeService()
    
    async def execute_test_suite(
        self,
        test_cases: List[GeneratedTestCase],
        capability_map: Dict[str, Any],
        exploration_run_id: Optional[str] = None,
        capability_map_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute all test cases and create defects from failures.
        
        Args:
            test_cases: List of generated test cases
            capability_map: Capability map data
            exploration_run_id: Exploration run ID
            capability_map_id: Capability map ID
            project_id: Project ID
        
        Returns:
            Execution results with defects
        """
        logger.info(f"Executing {len(test_cases)} test cases")
        
        results = []
        defects_created = []
        
        # Execute tests in batches (to avoid overwhelming the system)
        batch_size = 5
        for i in range(0, len(test_cases), batch_size):
            batch = test_cases[i:i + batch_size]
            batch_results = await asyncio.gather(
                *[self._execute_test_case(tc, capability_map, exploration_run_id, capability_map_id, project_id) for tc in batch],
                return_exceptions=True
            )
            
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Test execution error: {result}")
                    continue
                
                results.append(result)
                
                # If test failed and defect was created
                if result.get('status') == 'failed' and result.get('defect_id'):
                    defects_created.append(result['defect_id'])
        
        # Summary
        total = len(results)
        passed = len([r for r in results if r.get('status') == 'success'])
        failed = len([r for r in results if r.get('status') == 'failed'])
        
        logger.info(f"Test execution complete: {passed}/{total} passed, {failed} failed, {len(defects_created)} defects created")
        
        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'defects_created': len(defects_created),
            'defect_ids': defects_created,
            'results': results
        }
    
    async def _execute_test_case(
        self,
        test_case: GeneratedTestCase,
        capability_map: Dict[str, Any],
        exploration_run_id: Optional[str],
        capability_map_id: Optional[str],
        project_id: Optional[str]
    ) -> Dict[str, Any]:
        """Execute a single test case."""
        try:
            # Convert test case to Playwright code
            playwright_code = await self._test_case_to_playwright_code(test_case, capability_map)
            
            # Execute test
            execution_result = await self.test_execution_service.execute_test(
                test_code=playwright_code,
                test_name=test_case.title,
                browser="chromium",
                headless=True,
                timeout=30000
            )
            
            # Get test case ID if it exists in database
            test_case_id = None
            # TODO: Look up test case ID from database if it was saved
            
            # If test failed, defect should already be created by test_execution_service
            # But we can enhance it with capability map context
            if execution_result.get('status') == 'failed' and execution_result.get('defect_id'):
                # Enhance defect with capability map context
                try:
                    await self._enhance_defect_with_context(
                        execution_result['defect_id'],
                        test_case,
                        capability_map,
                        exploration_run_id,
                        capability_map_id
                    )
                except Exception as enhance_error:
                    logger.warning(f"Failed to enhance defect: {enhance_error}")
            
            return {
                'test_case_title': test_case.title,
                'test_case_type': test_case.test_type,
                'status': execution_result.get('status', 'unknown'),
                'execution_time': execution_result.get('execution_time_seconds', 0),
                'defect_id': execution_result.get('defect_id'),
                'error_message': execution_result.get('stderr', '')[:200] if execution_result.get('status') == 'failed' else None
            }
            
        except Exception as e:
            logger.error(f"Error executing test case {test_case.title}: {e}", exc_info=True)
            return {
                'test_case_title': test_case.title,
                'status': 'error',
                'error_message': str(e)[:200]
            }
    
    async def _test_case_to_playwright_code(
        self,
        test_case: GeneratedTestCase,
        capability_map: Dict[str, Any]
    ) -> str:
        """Convert test case to Playwright TypeScript code."""
        # Build Playwright code from test case steps
        code_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            f"test('{test_case.title}', async ({ page }) => {{"
        ]
        
        # Add steps
        for step in test_case.steps:
            action = step.get('action', '')
            
            # Simple action to code mapping
            if 'navigate' in action.lower() or 'goto' in action.lower():
                # Extract URL from capability map
                base_url = capability_map.get('base_url', '')
                if base_url:
                    code_lines.append(f"  await page.goto('{base_url}');")
            elif 'click' in action.lower():
                # Extract button/link text
                if 'button' in action.lower():
                    code_lines.append(f"  await page.getByRole('button').first().click();")
                elif 'submit' in action.lower():
                    code_lines.append(f"  await page.getByRole('button', {{ name: 'Submit' }}).click();")
            elif 'fill' in action.lower() or 'enter' in action.lower():
                # Extract field name
                code_lines.append(f"  await page.getByPlaceholder('Enter text').fill('test data');")
        
        code_lines.append("});")
        
        return "\n".join(code_lines)
    
    async def _enhance_defect_with_context(
        self,
        defect_id: str,
        test_case: GeneratedTestCase,
        capability_map: Dict[str, Any],
        exploration_run_id: Optional[str],
        capability_map_id: Optional[str]
    ):
        """Enhance defect with capability map and test case context."""
        try:
            from app.services.storage.postgres_direct import execute_query
            
            # Update defect with additional context
            query = """
                UPDATE defects
                SET exploration_run_id = %s,
                    capability_map_id = %s,
                    evidence = jsonb_set(
                        COALESCE(evidence, '{}'::jsonb),
                        '{test_case_context}',
                        %s::jsonb
                    ),
                    updated_at = NOW()
                WHERE id = %s
            """
            
            import json
            test_case_context = {
                'test_case_title': test_case.title,
                'test_case_type': test_case.test_type,
                'entity': test_case.entity,
                'operation': test_case.operation,
                'tags': test_case.tags
            }
            
            await execute_query(
                query,
                (
                    exploration_run_id,
                    capability_map_id,
                    json.dumps(test_case_context),
                    defect_id
                )
            )
            
        except Exception as e:
            logger.warning(f"Failed to enhance defect: {e}")







