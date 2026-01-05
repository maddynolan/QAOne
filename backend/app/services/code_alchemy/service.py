"""
CodeAlchemy Service
===================

Main orchestration service for the Repository-to-Test-Case pipeline.

Pipeline:
1. Connect to VCS (GitHub, GitLab, Bitbucket, Azure DevOps)
2. Download repository
3. Analyze with Framework Analyzer
4. Convert to executable Builder test cases
5. Import into test case database

All converted tests are EXECUTABLE - they can run just like
tests created manually in the Builder.
"""

import logging
import asyncio
import os
import shutil
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from .models import (
    AlchemyAnalysisResult,
    AlchemyTestCase,
    ImportJob,
    ImportJobStatus
)
from .converter import TestCaseConverter

# Import Framework Analyzer components
from app.services.framework_analyzer import (
    FrameworkAnalyzerService,
    VCSIntegration,
    get_vcs_integration,
    get_analyzer_service
)

logger = logging.getLogger(__name__)

# In-memory storage for analysis results and jobs
_analysis_cache: Dict[str, AlchemyAnalysisResult] = {}
_import_jobs: Dict[str, ImportJob] = {}


class CodeAlchemyService:
    """
    Transform any automation code repository into executable test cases.
    
    Usage:
        service = CodeAlchemyService()
        
        # Analyze repository
        result = await service.analyze_repository(
            url="https://github.com/user/selenium-tests",
            branch="main"
        )
        
        # Convert to test cases
        test_cases = service.get_test_cases_preview(result.analysis_id)
        
        # Import selected test cases
        job = await service.import_test_cases(
            analysis_id=result.analysis_id,
            selected_ids=[...],
            target_suite_name="Imported from Selenium"
        )
    """
    
    def __init__(self):
        self.vcs = get_vcs_integration()
        self.analyzer = get_analyzer_service()
        self.converter = TestCaseConverter()
    
    async def analyze_repository(
        self,
        url: str,
        branch: str = "main",
        token: Optional[str] = None,
        path: Optional[str] = None
    ) -> AlchemyAnalysisResult:
        """
        Analyze a repository and extract all test methods.
        
        Args:
            url: Repository URL (GitHub, GitLab, Bitbucket, Azure DevOps)
            branch: Branch to analyze
            token: Optional access token for private repos
            path: Optional path within repo to analyze
            
        Returns:
            AlchemyAnalysisResult with all extracted test cases
        """
        start_time = datetime.now()
        result = AlchemyAnalysisResult(
            repository_url=url,
            branch=branch
        )
        
        temp_dir = None
        
        try:
            logger.info(f"Starting CodeAlchemy analysis: {url} (branch: {branch})")
            
            # Step 1: Parse repository URL
            repo_info = self.vcs.parse_repo_url(url)
            if not repo_info:
                result.success = False
                result.error_message = f"Could not parse repository URL: {url}"
                return result
            
            result.provider = repo_info.provider.value
            logger.info(f"Detected provider: {result.provider}")
            
            # Step 2: Set up credentials if provided
            if token:
                from app.services.framework_analyzer.vcs_integration import VCSCredentials
                self.vcs.credentials[repo_info.provider] = VCSCredentials(token=token)
            
            # Step 3: Download repository
            logger.info("Downloading repository...")
            temp_dir = await self.vcs.download_repo(url, branch, path)
            logger.info(f"Downloaded to: {temp_dir}")
            
            # Step 4: Analyze with Framework Analyzer
            logger.info("Running Framework Analyzer...")
            analysis_result = await self.analyzer.analyze_directory(
                temp_dir,
                use_llm=False  # Disable LLM for faster processing
            )
            
            if not analysis_result.success:
                result.success = False
                result.error_message = analysis_result.error_message or "Analysis failed"
                return result
            
            # Step 5: Extract framework info
            if analysis_result.framework_info:
                result.framework_type = analysis_result.framework_info.framework_type.value
                result.framework_name = self._get_framework_display_name(
                    analysis_result.framework_info.framework_type.value
                )
                result.language = analysis_result.framework_info.language
                
                patterns = []
                if analysis_result.framework_info.uses_page_objects:
                    patterns.append("Page Object Model")
                if analysis_result.framework_info.uses_bdd:
                    patterns.append("BDD/Gherkin")
                if analysis_result.framework_info.uses_data_driven:
                    patterns.append("Data-Driven")
                result.patterns_used = patterns
            
            # Step 6: Extract domain info
            if analysis_result.domain_model:
                dm = analysis_result.domain_model
                result.domain = dm.domain
                result.entities = dm.entities
                result.files_analyzed = analysis_result.files_processed
                result.test_files_found = len(set(tm.file_path for tm in dm.test_methods))
                result.test_methods_found = len(dm.test_methods)
                result.page_objects_found = len(dm.pages)
                result.assertions_found = dm.total_assertions
                
                # Step 7: Convert test methods to executable test cases
                logger.info(f"Converting {len(dm.test_methods)} test methods...")
                self.converter.reset_stats()
                
                total_steps_extracted = 0
                for test_method in dm.test_methods:
                    steps_data = [
                        {
                            "action": step.action,
                            "target": step.target,
                            "value": step.value,
                            "description": step.description,
                            "original_code": step.original_code
                        }
                        for step in test_method.steps
                    ]
                    total_steps_extracted += len(steps_data)
                    if steps_data:
                        logger.info(f"Test '{test_method.name}' has {len(steps_data)} steps")
                    
                    test_case = self.converter.convert_test_method(
                        test_method={
                            "name": test_method.name,
                            "class_name": test_method.class_name,
                            "file_path": test_method.file_path,
                            "description": test_method.description,
                            "steps": steps_data,
                            "assertions": [
                                {
                                    "assertion_type": a.assertion_type.value,
                                    "expected_value": a.expected_value,
                                    "actual_expression": a.actual_expression,
                                    "original_code": a.original_code
                                }
                                for a in test_method.assertions
                            ],
                            "annotations": test_method.annotations,
                            "tags": test_method.tags,
                            "priority": test_method.priority
                        },
                        framework_type=result.framework_type,
                        language=result.language,
                        repository_url=url,
                        branch=branch
                    )
                    result.test_cases.append(test_case)
                
                logger.info(f"Total steps extracted from parser: {total_steps_extracted}")
                conversion_stats = self.converter.get_conversion_stats()
                logger.info(f"Conversion stats: {conversion_stats}")
            
            # Calculate duration
            result.duration_seconds = (datetime.now() - start_time).total_seconds()
            
            # Cache the result
            _analysis_cache[result.analysis_id] = result
            
            logger.info(f"Analysis complete! Found {result.test_methods_found} test methods in {result.duration_seconds:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"CodeAlchemy analysis failed: {e}", exc_info=True)
            result.success = False
            result.error_message = str(e)
            return result
            
        finally:
            # Cleanup temp directory
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                    logger.info(f"Cleaned up temp directory: {temp_dir}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp directory: {e}")
    
    async def detect_branches(self, url: str, token: Optional[str] = None) -> List[str]:
        """List available branches for a repository."""
        try:
            repo_info = self.vcs.parse_repo_url(url)
            if not repo_info:
                return ["main", "master"]
            
            # Set up credentials if provided
            if token:
                from app.services.framework_analyzer.vcs_integration import VCSCredentials
                self.vcs.credentials[repo_info.provider] = VCSCredentials(token=token)
            
            branches = await self.vcs.list_branches(url)
            return branches if branches else ["main", "master"]
            
        except Exception as e:
            logger.warning(f"Failed to list branches: {e}")
            return ["main", "master"]
    
    def get_analysis_result(self, analysis_id: str) -> Optional[AlchemyAnalysisResult]:
        """Get a cached analysis result."""
        return _analysis_cache.get(analysis_id)
    
    def get_test_cases_preview(
        self,
        analysis_id: str,
        filter_tags: Optional[List[str]] = None,
        filter_priority: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict]:
        """
        Get test cases preview (no code shown, just metadata).
        
        Returns minimal info for UI display:
        - id, name, description, priority, tags
        - step_count, assertion_count
        - original_file (just filename, not full path)
        """
        result = _analysis_cache.get(analysis_id)
        if not result:
            return []
        
        previews = []
        for tc in result.test_cases:
            # Apply filters
            if filter_tags:
                if not any(tag in tc.tags for tag in filter_tags):
                    continue
            
            if filter_priority and tc.priority != filter_priority:
                continue
            
            if search:
                search_lower = search.lower()
                if search_lower not in tc.name.lower() and search_lower not in tc.description.lower():
                    continue
            
            # Create preview (no code details)
            preview = {
                "id": tc.id,
                "name": tc.name,
                "description": tc.description,
                "priority": tc.priority,
                "tags": tc.tags,
                "stepCount": tc.step_count,
                "assertionCount": tc.assertion_count,
                "originalFile": Path(tc.original_file_path).name if tc.original_file_path else "",
                "originalClass": tc.original_class_name
            }
            previews.append(preview)
        
        return previews
    
    def get_available_tags(self, analysis_id: str) -> List[str]:
        """Get all unique tags from analysis result."""
        result = _analysis_cache.get(analysis_id)
        if not result:
            return []
        
        tags = set()
        for tc in result.test_cases:
            tags.update(tc.tags)
        
        return sorted(list(tags))
    
    async def import_test_cases(
        self,
        analysis_id: str,
        selected_ids: List[str],
        target_suite_id: Optional[str] = None,
        target_suite_name: str = "Imported Test Cases",
        options: Optional[Dict] = None
    ) -> ImportJob:
        """
        Import selected test cases into the Builder database.
        
        Args:
            analysis_id: Analysis result ID
            selected_ids: List of test case IDs to import
            target_suite_id: Existing suite ID (or None to create new)
            target_suite_name: Name for new suite
            options: Import options (e.g., preserve_tags, generate_descriptions)
            
        Returns:
            ImportJob for tracking progress
        """
        options = options or {}
        
        # Create import job
        job = ImportJob(
            analysis_id=analysis_id,
            selected_test_ids=selected_ids,
            target_suite_id=target_suite_id or "",
            target_suite_name=target_suite_name,
            total_test_cases=len(selected_ids),
            status=ImportJobStatus.IMPORTING,
            started_at=datetime.now().isoformat()
        )
        
        _import_jobs[job.job_id] = job
        
        # Get analysis result
        result = _analysis_cache.get(analysis_id)
        if not result:
            job.status = ImportJobStatus.FAILED
            job.errors.append({"error": "Analysis result not found"})
            return job
        
        # Filter test cases to import
        test_cases_to_import = [
            tc for tc in result.test_cases
            if tc.id in selected_ids
        ]
        
        # Import each test case
        try:
            for i, tc in enumerate(test_cases_to_import):
                job.current_item = tc.name
                job.progress_percent = (i / len(test_cases_to_import)) * 100
                
                try:
                    # Convert to Builder format
                    builder_format = tc.to_builder_format()
                    
                    # Debug: log steps count before saving
                    steps_count = len(builder_format.get("steps", []))
                    logger.info(f"Importing '{tc.name}' with {steps_count} steps, tc.steps has {len(tc.steps)} steps")
                    
                    # Add suite info
                    if target_suite_id:
                        builder_format["suiteId"] = target_suite_id
                    
                    # Add suite name to metadata for database storage
                    if "metadata" not in builder_format:
                        builder_format["metadata"] = {}
                    builder_format["metadata"]["suite_name"] = target_suite_name
                    builder_format["metadata"]["folder_id"] = f"imported_{analysis_id[:8]}"
                    
                    # Import to database
                    imported_id = await self._save_test_case(builder_format)
                    
                    job.imported_test_case_ids.append(imported_id)
                    job.imported_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to import test case {tc.name}: {e}")
                    job.failed_count += 1
                    job.errors.append({
                        "testCaseId": tc.id,
                        "name": tc.name,
                        "error": str(e)
                    })
            
            job.status = ImportJobStatus.COMPLETED
            job.progress_percent = 100
            job.completed_at = datetime.now().isoformat()
            
        except Exception as e:
            logger.error(f"Import job failed: {e}", exc_info=True)
            job.status = ImportJobStatus.FAILED
            job.errors.append({"error": str(e)})
        
        return job
    
    async def _save_test_case(self, test_case: Dict) -> str:
        """Save a test case to the SQLite database (shows in Test Repository)."""
        import sqlite3
        import os
        import json
        import uuid
        from datetime import datetime
        
        try:
            # Get database path - must match test_cases_crud_api.py path
            # service.py is at: backend/app/services/code_alchemy/service.py
            # We need: backend/data/scale_test.db
            db_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),  # backend/
                "data", "scale_test.db"
            )
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Ensure table has all required columns (add missing ones)
            cursor.execute("PRAGMA table_info(scale_test_cases)")
            existing_cols = {row[1] for row in cursor.fetchall()}
            
            if 'folder_name' not in existing_cols:
                cursor.execute("ALTER TABLE scale_test_cases ADD COLUMN folder_name TEXT")
            if 'automation_script_path' not in existing_cols:
                cursor.execute("ALTER TABLE scale_test_cases ADD COLUMN automation_script_path TEXT")
            
            # Prepare data
            case_id = test_case.get("id", str(uuid.uuid4()))
            name = test_case.get("name", "Imported Test")
            description = test_case.get("description", "")
            steps = json.dumps(test_case.get("steps", []))
            priority = test_case.get("priority", "Medium")
            tags = json.dumps(test_case.get("tags", []) + ["code_alchemy", "imported"])
            metadata = test_case.get("metadata", {})
            folder_id = metadata.get("folder_id", "code_alchemy_imports")
            folder_name = metadata.get("suite_name", "CodeAlchemy Imports")
            now = datetime.now().isoformat()
            
            # Insert into database
            cursor.execute('''
                INSERT OR REPLACE INTO scale_test_cases 
                (id, name, description, folder_id, folder_name, priority, status, tags, steps, 
                 automation_status, automation_script_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                case_id,
                name,
                description,
                folder_id,
                folder_name,
                priority,
                None,  # status - None means active
                tags,
                steps,
                "automated",
                None,  # automation_script_path
                now,
                now
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Test case saved to SQLite database: {case_id} - {name}")
            return case_id
            
        except Exception as e:
            logger.error(f"Failed to save test case to database: {e}", exc_info=True)
            return test_case.get("id", "unknown")
    
    def get_import_job_status(self, job_id: str) -> Optional[ImportJob]:
        """Get the status of an import job."""
        return _import_jobs.get(job_id)
    
    def _get_framework_display_name(self, framework_type: str) -> str:
        """Get human-readable framework name."""
        names = {
            "selenium-java": "Selenium + Java",
            "selenium-python": "Selenium + Python",
            "selenium-csharp": "Selenium + C#",
            "cypress": "Cypress",
            "playwright-python": "Playwright + Python",
            "playwright-typescript": "Playwright + TypeScript",
            "testng": "TestNG",
            "junit": "JUnit",
            "pytest": "PyTest",
            "robot-framework": "Robot Framework",
            "cucumber": "Cucumber/Gherkin",
            "katalon": "Katalon",
        }
        return names.get(framework_type, framework_type.replace("-", " ").title())


# Singleton service instance
_service: Optional[CodeAlchemyService] = None


def get_code_alchemy_service() -> CodeAlchemyService:
    """Get or create the CodeAlchemy service singleton."""
    global _service
    if _service is None:
        _service = CodeAlchemyService()
    return _service

