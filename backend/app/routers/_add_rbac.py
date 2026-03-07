#!/usr/bin/env python3
"""
Script to add RBAC decorators to all unprotected router files.
This adds @require_permission decorators to FastAPI endpoints.

Convention:
- GET -> :read
- POST -> :create or :execute (for scan/run/start endpoints)
- PUT/PATCH -> :update
- DELETE -> :delete

Skip: /health, /status endpoints, health_api.py, metrics_api.py, download_api.py, leads_api.py
"""

import re
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Files to skip entirely
SKIP_FILES = {
    '__init__.py',
    'health_api.py',
    'metrics_api.py',
    'download_api.py',
    'leads_api.py',
    # Utility/model files (not routers)
    'playwright_recorder_models.py',
    'playwright_recorder_utils.py',
    'ai_generation_models.py',
    'ai_generation_utils.py',
    'ai_key_resolver.py',
    'performance_utils.py',
    'agent_websocket.py',
    # Already protected
    'secrets_api.py',
    'database_api.py',
    'audit_api.py',
    'ai_settings_api.py',
    # Already done in this session
    'accessibility_api.py',
    'accessibility_scan_api.py',
    # This script
    '_add_rbac.py',
}

# Map router group directory to permission resource prefix
GROUP_TO_RESOURCE = {
    'accessibility': 'accessibility',
    'ai': 'ai',
    'api_testing': 'api_testing',
    'exploration': 'exploration',
    'performance': 'performance',
    'platform': 'platform',
    'recorder': 'recorder',
    'salesforce': 'salesforce',
    'test_management': 'test_management',
    'visual_testing': 'visual_testing',
    'integrations': 'integrations',
}

# Specific file -> resource overrides
FILE_TO_RESOURCE = {
    'defects_api.py': 'defects',
    'requirements_api.py': 'requirements',
    'project_management_api.py': 'projects',
    'license_api.py': 'license',
    'framework_analyzer_api.py': 'framework',
    'code_alchemy_api.py': 'code_alchemy',
    'dashboard_api.py': 'dashboard',
    'plugin_api.py': 'plugins',
    'tenants_api.py': 'tenants',
    'app_first_flow.py': 'platform',
    'traceability_api.py': 'traceability',
    'owasp_security_api.py': 'security',
    'server_monitoring_api.py': 'monitoring',
    'system_monitoring_api.py': 'monitoring',
    'oauth2_api.py': 'auth',
    'mfa_api.py': 'auth',
    'data_privacy_api.py': 'data_privacy',
    'test_cases_crud_api.py': 'test_cases',
    'test_runs_api.py': 'test_runs',
    'test_plans_api.py': 'test_plans',
    'gherkin_api.py': 'gherkin',
    'automation_api.py': 'automation',
    'complex_verifications.py': 'verifications',
    'mobile_flows_api.py': 'mobile',
    'requirement_to_testcase_api.py': 'test_cases',
    'test_case_api.py': 'test_cases',
    'test_case_rewrite_api.py': 'test_cases',
    'workflows_api.py': 'workflows',
    'sample_data_api.py': 'test_data',
    'test_environments_api.py': 'test_environments',
    'visual_testing_api.py': 'visual_testing',
    'jira_webhook.py': 'integrations',
    'enhanced_api_testing_api.py': 'api_testing',
    'api_import_api.py': 'api_testing',
    'request_chaining_api.py': 'api_testing',
    'collection_persistence_api.py': 'api_testing',
    'performance_api.py': 'performance',
    'protocol_recording_api.py': 'performance',
    'scale_api.py': 'test_cases',
    'ai_testing.py': 'ai_testing',
    'ai_enhancements_api.py': 'ai',
    'ai_automation_api.py': 'ai',
    'ai_generation_api.py': 'ai',
    'agents_api.py': 'agents',
    'vision_healing_api.py': 'ai',
    'llm_api.py': 'ai',
    'models_api.py': 'ai',
    'ocr_fallback_api.py': 'ai',
    'blaze_api.py': 'exploration',
    'exploration_api.py': 'exploration',
    'nexus_exploratory_api.py': 'exploration',
    'exploration_reporting_api.py': 'exploration',
    'exploration_test_generation_api.py': 'exploration',
    'exploration_workflow_api.py': 'exploration',
    'playwright_recorder_api.py': 'recorder',
    'cdp_recorder_api.py': 'recorder',
    'flowstral_api.py': 'recorder',
    'flowstral_engine_api.py': 'recorder',
    'flowstral_config_api.py': 'recorder',
    'salesforce_api.py': 'salesforce',
    'salesforce_auth.py': 'salesforce',
    'compliance_api.py': 'compliance',
}

# Endpoint paths that should be skipped (health/status)
SKIP_ENDPOINT_PATTERNS = [
    r'/health',
    r'/status',
    r'/{agent_type}/health',
]

# HTTP method to action mapping
METHOD_TO_ACTION = {
    'get': 'read',
    'post': 'create',
    'put': 'update',
    'patch': 'update',
    'delete': 'delete',
}

# POST endpoints that are "execute" rather than "create"
EXECUTE_PATH_PATTERNS = [
    r'/scan', r'/execute', r'/run', r'/start', r'/stop',
    r'/generate', r'/analyze', r'/fix', r'/detect',
    r'/explain', r'/resolve', r'/validate', r'/convert',
    r'/rerun', r'/check', r'/reset', r'/configure',
    r'/record', r'/sync', r'/import', r'/export',
    r'/batch', r'/quick', r'/ingest', r'/triage',
]


def get_action_for_endpoint(method: str, path: str) -> str:
    """Determine the RBAC action for an endpoint."""
    base_action = METHOD_TO_ACTION.get(method.lower(), 'read')

    if method.lower() == 'post':
        for pattern in EXECUTE_PATH_PATTERNS:
            if re.search(pattern, path, re.IGNORECASE):
                return 'execute'

    return base_action


def should_skip_endpoint(path: str) -> bool:
    """Check if endpoint should be skipped (health/status)."""
    for pattern in SKIP_ENDPOINT_PATTERNS:
        # Exact match or pattern match
        if path.strip('"\'') == pattern or re.match(pattern + '$', path.strip('"\'').rstrip('/')):
            return True

    # Also skip if path ends with /health or /status
    clean_path = path.strip('"\'').rstrip('/')
    if clean_path.endswith('/health') or clean_path.endswith('/status'):
        return True
    if clean_path == '' and False:  # Don't skip root
        return True

    return False


def process_file(filepath: str, resource: str, dry_run: bool = False) -> dict:
    """Process a single router file to add RBAC decorators."""
    filename = os.path.basename(filepath)

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if already has require_permission
    if 'require_permission' in content:
        return {'file': filename, 'status': 'already_protected', 'changes': 0}

    changes = 0
    lines = content.split('\n')
    new_lines = []

    # Step 1: Add import
    import_added = False
    has_request_import = 'Request' in content and ('from fastapi' in content)

    for i, line in enumerate(lines):
        new_lines.append(line)

        # Add import after the last fastapi import or after router = ...
        if not import_added:
            # Look for fastapi import to add our import after
            if line.strip().startswith('from fastapi import') or line.strip().startswith('from fastapi '):
                # Check if Request is already imported
                if 'Request' not in line and not has_request_import:
                    # Add Request to the import
                    pass  # We'll handle this separately
                # Add our import on the next appropriate line
                # But only if the next line isn't already our import
                continue

            # Add import after the logging/router definition block
            if 'router = APIRouter' in line:
                # Insert import before this line
                # Find the right place - after all imports
                pass

    # Simpler approach: just insert the import line
    new_lines = []
    import_inserted = False

    for i, line in enumerate(lines):
        # Insert our import after the last 'from app.' import or 'import' statement
        # but before any code (class definitions, function definitions, router = ...)
        if not import_inserted:
            if (line.strip().startswith('router = APIRouter') or
                line.strip().startswith('logger = ') or
                (line.strip().startswith('class ') and i > 5) or
                (line.strip().startswith('def ') and i > 5) or
                (line.strip().startswith('async def ') and i > 5)):

                # Add import before this line
                # Check if we need to add Request import too
                if not has_request_import:
                    # Check if fastapi is imported
                    fastapi_import_exists = any('from fastapi import' in l for l in lines[:i])
                    if fastapi_import_exists:
                        # We'll add Request by modifying the existing import later
                        pass

                new_lines.append('from app.middleware.rbac_middleware import require_permission')
                new_lines.append('')
                import_inserted = True
                changes += 1

        new_lines.append(line)

    if not import_inserted:
        return {'file': filename, 'status': 'no_router_found', 'changes': 0}

    # Step 2: Ensure Request is imported from fastapi
    if not has_request_import:
        for i, line in enumerate(new_lines):
            if 'from fastapi import' in line and 'Request' not in line:
                # Add Request to existing import
                new_lines[i] = line.rstrip().rstrip(')')
                if line.strip().endswith(')'):
                    new_lines[i] = line.rstrip()[:-1] + ', Request)'
                else:
                    new_lines[i] = line.rstrip() + ', Request'
                break

    # Step 3: Add @require_permission decorators to endpoints
    # Parse endpoint patterns: @router.get("/path"), @router.post("/path"), etc.
    final_lines = []
    i = 0
    while i < len(new_lines):
        line = new_lines[i]

        # Check if this is a router decorator
        router_match = re.match(r'^(\s*)@router\.(get|post|put|patch|delete)\(([^)]*)\)', line)

        if router_match:
            indent = router_match.group(1)
            method = router_match.group(2)
            path_arg = router_match.group(3)

            # Extract path string
            path = path_arg.strip().strip('"\'').split(',')[0].strip('"\'')

            if should_skip_endpoint(path):
                final_lines.append(line)
                i += 1
                continue

            action = get_action_for_endpoint(method, path)
            permission = f"{resource}:{action}"

            # Check if next line is already @require_permission
            if i + 1 < len(new_lines) and '@require_permission' in new_lines[i + 1]:
                final_lines.append(line)
                i += 1
                continue

            # Add the decorator after the @router line
            final_lines.append(line)
            final_lines.append(f'{indent}@require_permission("{permission}")')
            changes += 1

            # Now we need to ensure the function has request: Request parameter
            # Look ahead for the async def line
            j = i + 1
            while j < len(new_lines) and not new_lines[j].strip().startswith('async def ') and not new_lines[j].strip().startswith('def '):
                final_lines.append(new_lines[j])
                j += 1

            if j < len(new_lines):
                func_line = new_lines[j]
                # Check if function already has request: Request
                if 'request: Request' not in func_line and 'request:Request' not in func_line:
                    # Check if it has request: SomeModel (Pydantic conflict)
                    pydantic_request_match = re.search(r'request:\s*(\w+)', func_line)
                    if pydantic_request_match:
                        model_name = pydantic_request_match.group(1)
                        if model_name != 'Request':
                            # Rename 'request' to 'body' for the Pydantic model
                            func_line = func_line.replace(f'request: {model_name}', f'request: Request, body: {model_name}', 1)
                            func_line = func_line.replace(f'request:{model_name}', f'request: Request, body: {model_name}', 1)
                    else:
                        # No request param at all, add it
                        # Find the opening paren
                        paren_match = re.search(r'(async\s+def\s+\w+\()', func_line)
                        if paren_match:
                            insert_pos = paren_match.end()
                            # Check if there are already params
                            remaining = func_line[insert_pos:].strip()
                            if remaining.startswith(')') or remaining.startswith('\n'):
                                # No params
                                func_line = func_line[:insert_pos] + 'request: Request' + func_line[insert_pos:]
                            else:
                                # Has params, add request: Request as first
                                func_line = func_line[:insert_pos] + 'request: Request, ' + func_line[insert_pos:]

                final_lines.append(func_line)
                i = j + 1
            else:
                i += 1
        else:
            final_lines.append(line)
            i += 1

    result_content = '\n'.join(final_lines)

    if not dry_run and changes > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(result_content)

    return {'file': filename, 'status': 'updated' if changes > 0 else 'no_changes', 'changes': changes}


def main():
    dry_run = '--dry-run' in sys.argv
    verbose = '--verbose' in sys.argv or '-v' in sys.argv

    results = []

    for group_dir in sorted(os.listdir(BASE_DIR)):
        group_path = os.path.join(BASE_DIR, group_dir)
        if not os.path.isdir(group_path):
            continue

        resource = GROUP_TO_RESOURCE.get(group_dir)
        if not resource:
            continue

        for filename in sorted(os.listdir(group_path)):
            if not filename.endswith('.py'):
                continue
            if filename in SKIP_FILES:
                if verbose:
                    print(f"  SKIP: {group_dir}/{filename}")
                continue

            filepath = os.path.join(group_path, filename)
            file_resource = FILE_TO_RESOURCE.get(filename, resource)

            result = process_file(filepath, file_resource, dry_run=dry_run)
            results.append({**result, 'group': group_dir, 'resource': file_resource})

            status_icon = '✓' if result['status'] == 'updated' else '○' if result['status'] == 'already_protected' else '?'
            if verbose or result['changes'] > 0:
                print(f"  {status_icon} {group_dir}/{filename}: {result['status']} ({result['changes']} changes)")

    # Summary
    updated = sum(1 for r in results if r['status'] == 'updated')
    already = sum(1 for r in results if r['status'] == 'already_protected')
    total_changes = sum(r['changes'] for r in results)

    print(f"\nSummary: {updated} files updated, {already} already protected, {total_changes} total changes")
    if dry_run:
        print("(DRY RUN - no files modified)")


if __name__ == '__main__':
    main()
