"""
Traceability API Router
Provides comprehensive traceability matrix and coverage analysis
Requirements → Test Plans → Test Cases → Test Runs
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.utils.endpoint_helpers import ensure_default_org_project
from app.services.storage.postgres_direct import execute_query, get_postgres_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/traceability", tags=["traceability"])


@router.get("")
async def get_traceability_matrix(project_id: Optional[str] = None):
    """
    Get full traceability matrix showing:
    - Requirements → Test Plans → Test Cases → Test Runs
    - Coverage metrics
    - Gap analysis
    """
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        # Fetch all data
        requirements = await _fetch_requirements(project_id)
        test_plans = await _fetch_test_plans(project_id)
        test_cases = await _fetch_test_cases(project_id)
        test_runs = await _fetch_test_runs(project_id)
        
        # Build traceability links
        traceability = []
        
        for req in requirements:
            req_id = str(req.get('id', ''))
            
            # Find linked test cases (by requirement_id or linked_requirements)
            linked_cases = [
                tc for tc in test_cases 
                if str(tc.get('requirement_id', '')) == req_id or
                   req_id in (tc.get('linked_requirements') or [])
            ]
            
            # Find linked test plans
            linked_plans = [
                tp for tp in test_plans
                if req_id in (tp.get('requirement_ids') or []) or
                   any(str(tc.get('id', '')) in (tp.get('test_case_ids') or []) for tc in linked_cases)
            ]
            
            # Find linked test runs
            case_ids = [str(tc.get('id', '')) for tc in linked_cases]
            linked_runs = [
                tr for tr in test_runs
                if str(tr.get('test_case_id', '')) in case_ids
            ]
            
            # Calculate coverage
            has_plans = len(linked_plans) > 0
            has_cases = len(linked_cases) > 0
            has_runs = len(linked_runs) > 0
            passed_runs = len([r for r in linked_runs if r.get('status') == 'passed'])
            
            coverage = 0
            if has_cases:
                coverage += 40
            if has_plans:
                coverage += 20
            if has_runs:
                coverage += 20
            if passed_runs > 0:
                coverage += 20
            
            # Identify gaps
            gaps = []
            if not has_plans:
                gaps.append('No test plan linked')
            if not has_cases:
                gaps.append('No test cases linked')
            if has_cases and not has_runs:
                gaps.append('Test cases not executed')
            if has_runs and passed_runs == 0:
                gaps.append('All test runs failed')
            
            status = 'full' if coverage >= 80 else 'partial' if coverage >= 40 else 'none'
            
            traceability.append({
                'requirement': {
                    'id': req_id,
                    'title': req.get('title', 'Untitled'),
                    'description': req.get('description', ''),
                    'source': req.get('source', ''),
                    'source_ref': req.get('source_ref', ''),
                    'priority': req.get('priority', 'medium'),
                    'created_at': str(req.get('created_at', ''))
                },
                'test_plans': [
                    {
                        'id': str(tp.get('id', '')),
                        'name': tp.get('name', ''),
                        'status': tp.get('status', 'draft'),
                        'description': tp.get('description', '')
                    } for tp in linked_plans
                ],
                'test_cases': [
                    {
                        'id': str(tc.get('id', '')),
                        'title': tc.get('title', ''),
                        'priority': tc.get('priority', 'P2'),
                        'status': tc.get('status', 'draft')
                    } for tc in linked_cases
                ],
                'test_runs': [
                    {
                        'id': str(tr.get('id', '')),
                        'name': tr.get('name', ''),
                        'status': tr.get('status', 'pending'),
                        'executed_at': str(tr.get('executed_at', ''))
                    } for tr in linked_runs
                ],
                'defects': [],  # TODO: Link defects when available
                'coverage': coverage,
                'status': status,
                'gaps': gaps
            })
        
        # Calculate summary statistics
        total_reqs = len(requirements)
        covered_reqs = len([t for t in traceability if t['status'] == 'full'])
        partial_reqs = len([t for t in traceability if t['status'] == 'partial'])
        uncovered_reqs = len([t for t in traceability if t['status'] == 'none'])
        
        total_runs = len(test_runs)
        passed_runs = len([r for r in test_runs if r.get('status') == 'passed'])
        failed_runs = len([r for r in test_runs if r.get('status') == 'failed'])
        
        overall_coverage = round((covered_reqs / total_reqs * 100)) if total_reqs > 0 else 0
        execution_rate = round((total_runs / len(test_cases) * 100)) if len(test_cases) > 0 else 0
        pass_rate = round((passed_runs / total_runs * 100)) if total_runs > 0 else 0
        
        return {
            'traceability': traceability,
            'summary': {
                'total_requirements': total_reqs,
                'covered_requirements': covered_reqs,
                'partial_requirements': partial_reqs,
                'uncovered_requirements': uncovered_reqs,
                'total_test_plans': len(test_plans),
                'total_test_cases': len(test_cases),
                'total_test_runs': total_runs,
                'passed_runs': passed_runs,
                'failed_runs': failed_runs,
                'overall_coverage': overall_coverage,
                'execution_rate': execution_rate,
                'pass_rate': pass_rate
            },
            'generated_at': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error building traceability matrix: {str(e)}", exc_info=True)
        # Return empty data on error
        return {
            'traceability': [],
            'summary': {
                'total_requirements': 0,
                'covered_requirements': 0,
                'partial_requirements': 0,
                'uncovered_requirements': 0,
                'total_test_plans': 0,
                'total_test_cases': 0,
                'total_test_runs': 0,
                'passed_runs': 0,
                'failed_runs': 0,
                'overall_coverage': 0,
                'execution_rate': 0,
                'pass_rate': 0
            },
            'generated_at': datetime.utcnow().isoformat()
        }


@router.get("/gaps")
async def get_coverage_gaps(project_id: Optional[str] = None):
    """Get detailed coverage gap analysis"""
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        requirements = await _fetch_requirements(project_id)
        test_cases = await _fetch_test_cases(project_id)
        test_runs = await _fetch_test_runs(project_id)
        
        # Requirements without test cases
        covered_req_ids = set()
        for tc in test_cases:
            if tc.get('requirement_id'):
                covered_req_ids.add(str(tc.get('requirement_id')))
            for linked in (tc.get('linked_requirements') or []):
                covered_req_ids.add(str(linked))
        
        uncovered_requirements = [
            {
                'id': str(r.get('id', '')),
                'title': r.get('title', ''),
                'source': r.get('source', ''),
                'priority': r.get('priority', 'medium')
            }
            for r in requirements
            if str(r.get('id', '')) not in covered_req_ids
        ]
        
        # Test cases not executed
        executed_case_ids = set(str(tr.get('test_case_id', '')) for tr in test_runs)
        unexecuted_cases = [
            {
                'id': str(tc.get('id', '')),
                'title': tc.get('title', ''),
                'priority': tc.get('priority', 'P2')
            }
            for tc in test_cases
            if str(tc.get('id', '')) not in executed_case_ids
        ]
        
        # Failed test runs
        failed_runs = [
            {
                'id': str(tr.get('id', '')),
                'name': tr.get('name', ''),
                'test_case_id': str(tr.get('test_case_id', '')),
                'error_message': tr.get('error_message', ''),
                'executed_at': str(tr.get('executed_at', ''))
            }
            for tr in test_runs
            if tr.get('status') == 'failed'
        ]
        
        return {
            'uncovered_requirements': uncovered_requirements,
            'unexecuted_test_cases': unexecuted_cases,
            'failed_test_runs': failed_runs,
            'summary': {
                'uncovered_requirements_count': len(uncovered_requirements),
                'unexecuted_cases_count': len(unexecuted_cases),
                'failed_runs_count': len(failed_runs)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting coverage gaps: {str(e)}", exc_info=True)
        return {
            'uncovered_requirements': [],
            'unexecuted_test_cases': [],
            'failed_test_runs': [],
            'summary': {
                'uncovered_requirements_count': 0,
                'unexecuted_cases_count': 0,
                'failed_runs_count': 0
            }
        }


@router.get("/impact/{requirement_id}")
async def get_impact_analysis(requirement_id: str, project_id: Optional[str] = None):
    """
    Get impact analysis for a requirement change.
    Shows all test plans, test cases, and test runs that would be affected.
    """
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        test_plans = await _fetch_test_plans(project_id)
        test_cases = await _fetch_test_cases(project_id)
        test_runs = await _fetch_test_runs(project_id)
        
        # Find linked test cases
        affected_cases = [
            tc for tc in test_cases
            if str(tc.get('requirement_id', '')) == requirement_id or
               requirement_id in (tc.get('linked_requirements') or [])
        ]
        
        affected_case_ids = [str(tc.get('id', '')) for tc in affected_cases]
        
        # Find linked test plans
        affected_plans = [
            tp for tp in test_plans
            if requirement_id in (tp.get('requirement_ids') or []) or
               any(tc_id in (tp.get('test_case_ids') or []) for tc_id in affected_case_ids)
        ]
        
        # Find linked test runs
        affected_runs = [
            tr for tr in test_runs
            if str(tr.get('test_case_id', '')) in affected_case_ids
        ]
        
        return {
            'requirement_id': requirement_id,
            'affected_test_plans': [
                {'id': str(tp.get('id', '')), 'name': tp.get('name', '')}
                for tp in affected_plans
            ],
            'affected_test_cases': [
                {'id': str(tc.get('id', '')), 'title': tc.get('title', '')}
                for tc in affected_cases
            ],
            'affected_test_runs': [
                {'id': str(tr.get('id', '')), 'name': tr.get('name', ''), 'status': tr.get('status', '')}
                for tr in affected_runs
            ],
            'impact_summary': {
                'test_plans_count': len(affected_plans),
                'test_cases_count': len(affected_cases),
                'test_runs_count': len(affected_runs),
                'total_impact_score': len(affected_plans) + len(affected_cases) * 2 + len(affected_runs)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting impact analysis: {str(e)}", exc_info=True)
        return {
            'requirement_id': requirement_id,
            'affected_test_plans': [],
            'affected_test_cases': [],
            'affected_test_runs': [],
            'impact_summary': {
                'test_plans_count': 0,
                'test_cases_count': 0,
                'test_runs_count': 0,
                'total_impact_score': 0
            }
        }


@router.post("/link")
async def create_traceability_link(
    source_type: str,
    source_id: str,
    target_type: str,
    target_id: str
):
    """
    Create a traceability link between items.
    Supported links:
    - requirement → test_case
    - requirement → test_plan
    - test_case → test_plan
    """
    try:
        # Validate link types
        valid_links = [
            ('requirement', 'test_case'),
            ('requirement', 'test_plan'),
            ('test_case', 'test_plan'),
        ]
        
        if (source_type, target_type) not in valid_links:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid link: {source_type} → {target_type}"
            )
        
        # Create link based on type
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database unavailable")
        
        if source_type == 'requirement' and target_type == 'test_case':
            # Update test_case.requirement_id
            query = """
                UPDATE test_cases 
                SET requirement_id = %s, updated_at = NOW()
                WHERE id = %s
            """
            await execute_query(query, (source_id, target_id))
            
        elif source_type == 'requirement' and target_type == 'test_plan':
            # Add to test_plan.requirement_ids (JSON array)
            query = """
                UPDATE test_plans 
                SET settings = jsonb_set(
                    COALESCE(settings, '{}'::jsonb),
                    '{requirement_ids}',
                    COALESCE(settings->'requirement_ids', '[]'::jsonb) || %s::jsonb
                ),
                updated_at = NOW()
                WHERE id = %s
            """
            await execute_query(query, (f'["{source_id}"]', target_id))
            
        elif source_type == 'test_case' and target_type == 'test_plan':
            # Add to test_plan.test_case_ids
            query = """
                UPDATE test_plans 
                SET settings = jsonb_set(
                    COALESCE(settings, '{}'::jsonb),
                    '{test_case_ids}',
                    COALESCE(settings->'test_case_ids', '[]'::jsonb) || %s::jsonb
                ),
                updated_at = NOW()
                WHERE id = %s
            """
            await execute_query(query, (f'["{source_id}"]', target_id))
        
        return {
            'status': 'success',
            'link': {
                'source_type': source_type,
                'source_id': source_id,
                'target_type': target_type,
                'target_id': target_id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating traceability link: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== HELPER FUNCTIONS ====================

async def _fetch_requirements(project_id: str) -> List[Dict[str, Any]]:
    """Fetch requirements from database"""
    try:
        query = """
            SELECT id, project_id, source, source_ref, title, description, 
                   acceptance_criteria, raw_payload, created_at
            FROM requirements
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        return results or []
    except Exception as e:
        logger.warning(f"Could not fetch requirements: {e}")
        return []


async def _fetch_test_plans(project_id: str) -> List[Dict[str, Any]]:
    """Fetch test plans from database"""
    try:
        query = """
            SELECT id, project_id, name, description, status, settings, created_at, updated_at
            FROM test_plans
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        
        # Extract requirement_ids and test_case_ids from settings
        plans = []
        for row in (results or []):
            settings = row.get('settings') or {}
            plans.append({
                **row,
                'requirement_ids': settings.get('requirement_ids', []),
                'test_case_ids': settings.get('test_case_ids', [])
            })
        return plans
    except Exception as e:
        logger.warning(f"Could not fetch test plans: {e}")
        return []


async def _fetch_test_cases(project_id: str) -> List[Dict[str, Any]]:
    """Fetch test cases from database"""
    try:
        query = """
            SELECT id, project_id, title, description, priority, status, 
                   requirement_id, steps, expected_results, created_at, updated_at
            FROM test_cases
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        return results or []
    except Exception as e:
        logger.warning(f"Could not fetch test cases: {e}")
        return []


async def _fetch_test_runs(project_id: str) -> List[Dict[str, Any]]:
    """Fetch test runs from database"""
    try:
        query = """
            SELECT id, project_id, name, status, test_case_id, 
                   environment, created_at, updated_at
            FROM test_runs
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        
        # Map created_at to executed_at for consistency
        runs = []
        for row in (results or []):
            runs.append({
                **row,
                'executed_at': row.get('created_at')
            })
        return runs
    except Exception as e:
        logger.warning(f"Could not fetch test runs: {e}")
        return []
















