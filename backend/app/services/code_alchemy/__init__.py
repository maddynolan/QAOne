"""
CodeAlchemy - Repository to Test Case Transformer
==================================================

Transform any automation code repository into visual test cases.

Features:
- Connect to GitHub, GitLab, Bitbucket, Azure DevOps
- Auto-detect framework (Selenium, Cypress, Playwright, etc.)
- Extract all test methods
- Convert to Builder test case format
- Bulk import with progress tracking

Usage:
    from app.services.code_alchemy import CodeAlchemyService
    
    service = CodeAlchemyService()
    result = await service.analyze_repository("https://github.com/user/repo")
    test_cases = await service.convert_to_builder_format(result)
"""

from .service import CodeAlchemyService, get_code_alchemy_service
from .converter import TestCaseConverter
from .models import (
    AlchemyAnalysisResult,
    AlchemyTestCase,
    ImportJob,
    ImportJobStatus
)

__all__ = [
    'CodeAlchemyService',
    'get_code_alchemy_service',
    'TestCaseConverter',
    'AlchemyAnalysisResult',
    'AlchemyTestCase',
    'ImportJob',
    'ImportJobStatus'
]

