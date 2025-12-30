"""
Framework Analyzer Service

Main service that orchestrates the framework analysis pipeline:
1. Parse code files
2. Detect framework type
3. Extract domain model
4. Generate outputs
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import tempfile
import zipfile
import os

from .models import AnalysisResult, DomainModel, FrameworkInfo
from .code_parser import CodeParser, ParsedFile
from .framework_detector import FrameworkDetector
from .domain_extractor import DomainExtractor
from .output_generator import OutputGenerator
from .framework_converter import FrameworkCodeConverter

logger = logging.getLogger(__name__)


class FrameworkAnalyzerService:
    """
    Main service for analyzing automation frameworks.
    
    Supports:
    - Analyzing local directories
    - Analyzing uploaded zip files
    - Analyzing code snippets
    - Analyzing GitHub repositories (TODO)
    """
    
    def __init__(self, llm_client=None):
        """
        Initialize the analyzer service.
        
        Args:
            llm_client: Optional OpenAI client for LLM-enhanced analysis
        """
        self.code_parser = CodeParser()
        self.framework_detector = FrameworkDetector()
        self.domain_extractor = DomainExtractor(llm_client)
        self.llm_client = llm_client
    
    async def analyze_directory(
        self,
        directory_path: str,
        use_llm: bool = True,
        file_extensions: List[str] = None,
    ) -> AnalysisResult:
        """
        Analyze a local directory containing automation code.
        
        Args:
            directory_path: Path to the directory
            use_llm: Whether to use LLM for enhanced analysis
            file_extensions: File extensions to process (default: common test files)
        """
        start_time = datetime.now()
        
        try:
            logger.info(f"Starting analysis of directory: {directory_path}")
            
            # Step 1: Detect framework from directory structure
            framework_info = self.framework_detector.detect_from_directory(directory_path)
            logger.info(f"Detected framework: {framework_info.framework_type.value}")
            
            # Step 2: Parse all code files
            parsed_files = self.code_parser.parse_directory(directory_path, file_extensions)
            logger.info(f"Parsed {len(parsed_files)} files")
            
            if not parsed_files:
                return AnalysisResult(
                    success=False,
                    error_message="No automation files found in directory",
                    framework_info=framework_info,
                )
            
            # Step 3: Refine framework detection with parsed content
            refined_framework = self.framework_detector.detect_from_files(parsed_files)
            # Merge info
            framework_info.uses_page_objects = framework_info.uses_page_objects or refined_framework.uses_page_objects
            framework_info.uses_bdd = framework_info.uses_bdd or refined_framework.uses_bdd
            framework_info.uses_data_driven = framework_info.uses_data_driven or refined_framework.uses_data_driven
            
            # Step 4: Extract domain model
            domain_model = self.domain_extractor.extract_domain_model(
                parsed_files,
                framework_info,
                use_llm=use_llm
            )
            logger.info(f"Extracted domain model: {domain_model.domain}, {len(domain_model.entities)} entities")
            
            # Calculate duration
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            # Count errors
            files_with_errors = [pf.file_path for pf in parsed_files if pf.errors]
            
            return AnalysisResult(
                success=True,
                started_at=start_time,
                completed_at=end_time,
                duration_seconds=duration,
                framework_info=framework_info,
                domain_model=domain_model,
                files_processed=len(parsed_files),
                files_with_errors=files_with_errors,
            )
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}", exc_info=True)
            return AnalysisResult(
                success=False,
                error_message=str(e),
                started_at=start_time,
            )
    
    async def analyze_zip_file(
        self,
        zip_content: bytes,
        use_llm: bool = True,
    ) -> AnalysisResult:
        """
        Analyze a zip file containing automation code.
        
        Args:
            zip_content: Zip file content as bytes
            use_llm: Whether to use LLM for enhanced analysis
        """
        # Extract to temp directory
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = Path(temp_dir) / "upload.zip"
            zip_path.write_bytes(zip_content)
            
            # Extract zip
            extract_dir = Path(temp_dir) / "extracted"
            extract_dir.mkdir()
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Analyze extracted directory
            return await self.analyze_directory(str(extract_dir), use_llm)
    
    async def analyze_code_snippet(
        self,
        code: str,
        file_name: str = "snippet.java",
        use_llm: bool = True,
    ) -> AnalysisResult:
        """
        Analyze a single code snippet.
        
        Args:
            code: The code content
            file_name: File name to determine language
            use_llm: Whether to use LLM for enhanced analysis
        """
        start_time = datetime.now()
        
        try:
            # Parse the code
            parsed_file = self.code_parser.parse_file(file_name, code)
            
            # Detect framework from code
            ext = Path(file_name).suffix
            framework_info = self.framework_detector.detect_from_code(code, ext)
            
            # Extract domain model
            domain_model = self.domain_extractor.extract_domain_model(
                [parsed_file],
                framework_info,
                use_llm=use_llm
            )
            
            end_time = datetime.now()
            
            return AnalysisResult(
                success=True,
                started_at=start_time,
                completed_at=end_time,
                duration_seconds=(end_time - start_time).total_seconds(),
                framework_info=framework_info,
                domain_model=domain_model,
                files_processed=1,
                files_with_errors=parsed_file.errors if parsed_file.errors else [],
            )
            
        except Exception as e:
            logger.error(f"Snippet analysis failed: {e}", exc_info=True)
            return AnalysisResult(
                success=False,
                error_message=str(e),
                started_at=start_time,
            )
    
    async def analyze_github_repo(
        self,
        repo_url: str,
        branch: str = "main",
        use_llm: bool = True,
    ) -> AnalysisResult:
        """
        Analyze a GitHub repository.
        
        Args:
            repo_url: GitHub repository URL
            branch: Branch to analyze
            use_llm: Whether to use LLM for enhanced analysis
        """
        # TODO: Implement GitHub integration
        # 1. Clone repo to temp directory
        # 2. Analyze directory
        # 3. Clean up
        
        return AnalysisResult(
            success=False,
            error_message="GitHub analysis not yet implemented",
        )
    
    def generate_outputs(
        self,
        analysis_result: AnalysisResult,
        output_types: List[str] = None,
    ) -> Dict[str, str]:
        """
        Generate outputs from analysis result.
        
        Args:
            analysis_result: The analysis result to generate outputs from
            output_types: List of output types to generate
                         ("requirements", "test_cases", "domain_docs", "elements", "coverage")
        """
        if not analysis_result.success or not analysis_result.domain_model:
            return {"error": "Cannot generate outputs from failed analysis"}
        
        if output_types is None:
            output_types = ["requirements", "test_cases", "domain_docs", "coverage"]
        
        generator = OutputGenerator(
            analysis_result.domain_model,
            analysis_result.framework_info
        )
        
        outputs = {}
        
        if "requirements" in output_types:
            outputs["requirements_md"] = generator.generate_requirements_document("markdown")
            outputs["requirements_json"] = generator.generate_requirements_document("json")
        
        if "test_cases" in output_types:
            outputs["test_cases_istqb"] = generator.generate_test_cases("istqb")
            outputs["test_cases_gherkin"] = generator.generate_test_cases("gherkin")
            outputs["test_cases_json"] = generator.generate_test_cases("json")
        
        if "domain_docs" in output_types:
            outputs["domain_documentation"] = generator.generate_domain_documentation()
        
        if "elements" in output_types:
            outputs["element_repository_json"] = generator.generate_element_repository("json")
            outputs["element_repository_csv"] = generator.generate_element_repository("csv")
        
        if "coverage" in output_types:
            outputs["coverage_report"] = generator.generate_coverage_report()
        
        return outputs
    
    def convert_framework(
        self,
        analysis_result: AnalysisResult,
        target_framework: str = "playwright-python",
        include_page_objects: bool = True,
    ) -> Dict[str, str]:
        """
        Convert the analyzed framework to a target framework.
        
        Args:
            analysis_result: The analysis result to convert
            target_framework: Target framework to convert to
            include_page_objects: Whether to generate Page Objects
        """
        if not analysis_result.success or not analysis_result.domain_model:
            return {"error": "Cannot convert from failed analysis"}
        
        converter = FrameworkCodeConverter(
            analysis_result.domain_model,
            analysis_result.framework_info
        )
        
        return converter.convert_to_framework(
            target_framework,
            include_page_objects=include_page_objects,
        )
    
    def get_analysis_summary(self, analysis_result: AnalysisResult) -> Dict[str, Any]:
        """Get a summary of the analysis result."""
        if not analysis_result.success:
            return {
                "success": False,
                "error": analysis_result.error_message,
            }
        
        framework_summary = self.framework_detector.get_framework_summary(
            analysis_result.framework_info
        )
        
        domain_summary = self.domain_extractor.get_domain_summary(
            analysis_result.domain_model
        ) if analysis_result.domain_model else {}
        
        return {
            "success": True,
            "duration_seconds": analysis_result.duration_seconds,
            "files_processed": analysis_result.files_processed,
            "framework": framework_summary,
            "domain": domain_summary,
            "warnings": analysis_result.warnings,
        }


# Singleton instance
_analyzer_service: Optional[FrameworkAnalyzerService] = None


def get_analyzer_service(llm_client=None) -> FrameworkAnalyzerService:
    """Get or create the analyzer service singleton."""
    global _analyzer_service
    if _analyzer_service is None:
        _analyzer_service = FrameworkAnalyzerService(llm_client)
    return _analyzer_service

