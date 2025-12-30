"""
Framework Analyzer Service

Analyzes automation frameworks to extract:
- Domain models (entities, pages, flows)
- Requirements from assertions
- Test cases from test methods
- Converts between frameworks

Supported Input Frameworks:
- Selenium (Java, Python, C#)
- Cypress (JavaScript)
- Playwright (Python, TypeScript)
- TestNG/JUnit (Java)
- PyTest (Python)
- Robot Framework
- Cucumber/Gherkin

Output Options:
- Requirements Document (Markdown, JSON)
- Test Cases (ISTQB, Gherkin, Markdown)
- Converted Framework Code
- Domain Model Documentation
- Coverage Analysis Report
"""

from .models import (
    DomainModel,
    PageObject,
    TestMethod,
    Locator,
    Assertion,
    UserFlow,
    BusinessRule,
    FrameworkInfo,
    AnalysisResult
)

from .code_parser import CodeParser
from .framework_detector import FrameworkDetector
from .domain_extractor import DomainExtractor
from .output_generator import OutputGenerator
from .framework_converter import FrameworkCodeConverter
from .vcs_integration import VCSIntegration, VCSProvider, VCSCredentials, get_vcs_integration
from .analyzer_service import FrameworkAnalyzerService, get_analyzer_service

__all__ = [
    'DomainModel',
    'PageObject', 
    'TestMethod',
    'Locator',
    'Assertion',
    'UserFlow',
    'BusinessRule',
    'FrameworkInfo',
    'AnalysisResult',
    'CodeParser',
    'FrameworkDetector',
    'DomainExtractor',
    'OutputGenerator',
    'FrameworkCodeConverter',
    'VCSIntegration',
    'VCSProvider',
    'VCSCredentials',
    'get_vcs_integration',
    'FrameworkAnalyzerService',
    'get_analyzer_service',
]

