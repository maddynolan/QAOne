"""
Framework Analyzer API Router

Endpoints for analyzing automation frameworks and generating outputs.
Supports code snippets, directories, uploads, and VCS repositories.
"""

import logging
import json
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from datetime import datetime
import io
import zipfile

from app.services.framework_analyzer.analyzer_service import (
    FrameworkAnalyzerService,
    get_analyzer_service
)
from app.services.framework_analyzer.vcs_integration import (
    VCSIntegration,
    get_vcs_integration,
    VCSCredentials,
    VCSProvider
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/framework-analyzer", tags=["framework-analyzer"])


# ==================== REQUEST MODELS ====================

class AnalyzeCodeRequest(BaseModel):
    """Request for analyzing a code snippet."""
    code: str
    file_name: str = "snippet.java"
    use_llm: bool = True


class AnalyzeDirectoryRequest(BaseModel):
    """Request for analyzing a directory."""
    directory_path: str
    use_llm: bool = True
    file_extensions: Optional[List[str]] = None


class GenerateOutputsRequest(BaseModel):
    """Request for generating outputs."""
    output_types: List[str] = ["requirements", "test_cases", "domain_docs", "coverage"]
    format: str = "markdown"  # markdown, json, html


class ConvertFrameworkRequest(BaseModel):
    """Request for converting framework."""
    target_framework: str = "playwright-python"
    include_page_objects: bool = True
    include_fixtures: bool = True


class AnalyzeGitHubRequest(BaseModel):
    """Request for analyzing a GitHub repository."""
    repo_url: str
    branch: str = "main"
    use_llm: bool = True


class AnalyzeVCSRequest(BaseModel):
    """Request for analyzing a VCS repository (GitHub, GitLab, Bitbucket, Azure DevOps)."""
    repo_url: str
    branch: Optional[str] = None
    path: Optional[str] = None  # Specific path within repo
    use_llm: bool = True
    # Optional credentials (if not using env vars)
    token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


class ListBranchesRequest(BaseModel):
    """Request for listing branches in a repository."""
    repo_url: str
    token: Optional[str] = None


# ==================== API ENDPOINTS ====================

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "framework-analyzer"}


@router.post("/analyze/code")
async def analyze_code(request: AnalyzeCodeRequest):
    """
    Analyze a single code snippet.
    
    Use this for quick analysis of small code samples.
    """
    try:
        service = get_analyzer_service()
        result = await service.analyze_code_snippet(
            code=request.code,
            file_name=request.file_name,
            use_llm=request.use_llm,
        )
        
        summary = service.get_analysis_summary(result)
        
        # Store result for subsequent operations (generate, convert)
        _store_analysis_result(result)
        
        return {
            "status": "success" if result.success else "error",
            "analysis": summary,
            "result": result.to_dict(),
        }
        
    except Exception as e:
        logger.error(f"Code analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/directory")
async def analyze_directory(request: AnalyzeDirectoryRequest):
    """
    Analyze a local directory containing automation code.
    
    The directory should contain test files in supported formats
    (Java, Python, JavaScript, TypeScript, Robot Framework, Gherkin).
    """
    try:
        service = get_analyzer_service()
        result = await service.analyze_directory(
            directory_path=request.directory_path,
            use_llm=request.use_llm,
            file_extensions=request.file_extensions,
        )
        
        summary = service.get_analysis_summary(result)
        
        # Store result for subsequent operations
        # (In production, use proper caching/session storage)
        _store_analysis_result(result)
        
        return {
            "status": "success" if result.success else "error",
            "analysis": summary,
            "result": result.to_dict(),
        }
        
    except Exception as e:
        logger.error(f"Directory analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/upload")
async def analyze_uploaded_zip(
    file: UploadFile = File(...),
    use_llm: bool = Form(True),
):
    """
    Analyze an uploaded zip file containing automation code.
    
    Upload a zip file with your automation framework code.
    The system will extract and analyze all supported files.
    """
    try:
        if not file.filename.endswith('.zip'):
            raise HTTPException(
                status_code=400,
                detail="Only .zip files are supported"
            )
        
        # Read zip content
        content = await file.read()
        
        service = get_analyzer_service()
        result = await service.analyze_zip_file(content, use_llm)
        
        summary = service.get_analysis_summary(result)
        
        # Store result for subsequent operations
        _store_analysis_result(result)
        
        return {
            "status": "success" if result.success else "error",
            "filename": file.filename,
            "analysis": summary,
            "result": result.to_dict(),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/vcs")
async def analyze_vcs_repo(request: AnalyzeVCSRequest):
    """
    Analyze a repository from any supported VCS provider.
    
    Supported providers:
    - GitHub (github.com)
    - GitLab (gitlab.com)
    - Bitbucket (bitbucket.org)
    - Azure DevOps (dev.azure.com)
    
    For private repositories, provide authentication:
    - GitHub: Use `token` (Personal Access Token)
    - GitLab: Use `token` (Private Token)
    - Bitbucket: Use `username` and `password` (App Password)
    - Azure DevOps: Use `token` (Personal Access Token)
    """
    temp_dir = None
    try:
        vcs = get_vcs_integration()
        
        # Parse repo URL to detect provider
        repo_info = vcs.parse_repo_url(request.repo_url)
        if not repo_info:
            raise HTTPException(
                status_code=400,
                detail="Could not parse repository URL. Supported providers: GitHub, GitLab, Bitbucket, Azure DevOps"
            )
        
        # Set up credentials if provided
        if request.token or request.username:
            if repo_info.provider == VCSProvider.BITBUCKET and request.username and request.password:
                vcs.credentials[repo_info.provider] = VCSCredentials(
                    username=request.username,
                    password=request.password
                )
            elif request.token:
                vcs.credentials[repo_info.provider] = VCSCredentials(token=request.token)
        
        # Download repository
        temp_dir = await vcs.download_repo(
            url=request.repo_url,
            branch=request.branch,
            path=request.path,
        )
        
        # Analyze the downloaded repository
        service = get_analyzer_service()
        result = await service.analyze_directory(
            directory_path=temp_dir,
            use_llm=request.use_llm,
        )
        
        summary = service.get_analysis_summary(result)
        
        # Store result for subsequent operations
        _store_analysis_result(result)
        
        return {
            "status": "success" if result.success else "error",
            "repo_url": request.repo_url,
            "provider": repo_info.provider.value,
            "branch": request.branch or repo_info.branch,
            "analysis": summary,
            "result": result.to_dict(),
        }
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"VCS analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp directory
        if temp_dir:
            vcs = get_vcs_integration()
            vcs.cleanup(temp_dir)


@router.post("/analyze/github")
async def analyze_github_repo(request: AnalyzeGitHubRequest):
    """
    Analyze a GitHub repository (convenience endpoint).
    
    For more options, use /analyze/vcs instead.
    """
    vcs_request = AnalyzeVCSRequest(
        repo_url=request.repo_url,
        branch=request.branch,
        use_llm=request.use_llm,
    )
    return await analyze_vcs_repo(vcs_request)


@router.post("/vcs/branches")
async def list_vcs_branches(request: ListBranchesRequest):
    """
    List available branches for a repository.
    
    Works with GitHub, GitLab, Bitbucket, and Azure DevOps.
    """
    try:
        vcs = get_vcs_integration()
        
        # Parse URL to detect provider
        repo_info = vcs.parse_repo_url(request.repo_url)
        if not repo_info:
            raise HTTPException(
                status_code=400,
                detail="Could not parse repository URL"
            )
        
        # Set credentials if provided
        if request.token:
            vcs.credentials[repo_info.provider] = VCSCredentials(token=request.token)
        
        branches = await vcs.list_branches(request.repo_url)
        
        return {
            "status": "success",
            "repo_url": request.repo_url,
            "provider": repo_info.provider.value,
            "branches": branches,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list branches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vcs/validate")
async def validate_repo_url(repo_url: str):
    """
    Validate a repository URL and detect its provider.
    """
    try:
        vcs = get_vcs_integration()
        repo_info = vcs.parse_repo_url(repo_url)
        
        if repo_info:
            return {
                "valid": True,
                "provider": repo_info.provider.value,
                "owner": repo_info.owner,
                "repo": repo_info.repo,
                "detected_branch": repo_info.branch,
            }
        else:
            return {
                "valid": False,
                "message": "Could not parse repository URL",
                "supported_providers": ["github", "gitlab", "bitbucket", "azure-devops"],
            }
            
    except Exception as e:
        return {
            "valid": False,
            "message": str(e),
        }


@router.post("/generate/requirements")
async def generate_requirements(format: str = "markdown"):
    """
    Generate requirements document from the last analysis.
    
    Args:
        format: Output format (markdown, json, html)
    """
    try:
        result = _get_stored_analysis_result()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="No analysis result available. Run analysis first."
            )
        
        service = get_analyzer_service()
        outputs = service.generate_outputs(result, ["requirements"])
        
        if format == "json":
            return JSONResponse(content=json.loads(outputs.get("requirements_json", "{}")))
        else:
            return {
                "status": "success",
                "format": format,
                "content": outputs.get("requirements_md", ""),
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Requirements generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/test-cases")
async def generate_test_cases(format: str = "istqb"):
    """
    Generate test cases from the last analysis.
    
    Args:
        format: Output format (istqb, gherkin, markdown, json)
    """
    try:
        result = _get_stored_analysis_result()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="No analysis result available. Run analysis first."
            )
        
        service = get_analyzer_service()
        outputs = service.generate_outputs(result, ["test_cases"])
        
        format_key_map = {
            "istqb": "test_cases_istqb",
            "gherkin": "test_cases_gherkin",
            "json": "test_cases_json",
            "markdown": "test_cases_istqb",
        }
        
        content_key = format_key_map.get(format, "test_cases_istqb")
        
        if format == "json":
            return JSONResponse(content=json.loads(outputs.get(content_key, "{}")))
        else:
            return {
                "status": "success",
                "format": format,
                "content": outputs.get(content_key, ""),
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test case generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/domain-docs")
async def generate_domain_documentation():
    """Generate domain documentation from the last analysis."""
    try:
        result = _get_stored_analysis_result()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="No analysis result available. Run analysis first."
            )
        
        service = get_analyzer_service()
        outputs = service.generate_outputs(result, ["domain_docs"])
        
        return {
            "status": "success",
            "content": outputs.get("domain_documentation", ""),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Domain docs generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/elements")
async def generate_element_repository(format: str = "json"):
    """
    Generate element repository from the last analysis.
    
    Args:
        format: Output format (json, csv, markdown)
    """
    try:
        result = _get_stored_analysis_result()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="No analysis result available. Run analysis first."
            )
        
        service = get_analyzer_service()
        outputs = service.generate_outputs(result, ["elements"])
        
        if format == "json":
            return JSONResponse(content=json.loads(outputs.get("element_repository_json", "{}")))
        elif format == "csv":
            return {
                "status": "success",
                "format": "csv",
                "content": outputs.get("element_repository_csv", ""),
            }
        else:
            return {
                "status": "success",
                "format": format,
                "content": outputs.get("element_repository_json", ""),
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Element repository generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/coverage")
async def generate_coverage_report():
    """Generate coverage analysis report from the last analysis."""
    try:
        result = _get_stored_analysis_result()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="No analysis result available. Run analysis first."
            )
        
        service = get_analyzer_service()
        outputs = service.generate_outputs(result, ["coverage"])
        
        return {
            "status": "success",
            "content": outputs.get("coverage_report", ""),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Coverage report generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/convert")
async def convert_framework(request: ConvertFrameworkRequest):
    """
    Convert the analyzed framework to a target framework.
    
    Supported targets:
    - playwright-python
    - playwright-typescript
    - cypress
    - selenium-python
    """
    try:
        result = _get_stored_analysis_result()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="No analysis result available. Run analysis first."
            )
        
        service = get_analyzer_service()
        converted_files = service.convert_framework(
            result,
            target_framework=request.target_framework,
            include_page_objects=request.include_page_objects,
        )
        
        return {
            "status": "success",
            "target_framework": request.target_framework,
            "files": converted_files,
            "file_count": len(converted_files),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Framework conversion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/convert/download")
async def download_converted_framework(request: ConvertFrameworkRequest):
    """
    Download the converted framework as a zip file.
    """
    try:
        result = _get_stored_analysis_result()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="No analysis result available. Run analysis first."
            )
        
        service = get_analyzer_service()
        converted_files = service.convert_framework(
            result,
            target_framework=request.target_framework,
            include_page_objects=request.include_page_objects,
        )
        
        # Create zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename, content in converted_files.items():
                zip_file.writestr(filename, content)
        
        zip_buffer.seek(0)
        
        # Generate filename
        domain = result.domain_model.domain if result.domain_model else "converted"
        zip_filename = f"{domain}_{request.target_framework}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/frameworks")
async def list_supported_frameworks():
    """List all supported source and target frameworks."""
    return {
        "source_frameworks": [
            {"id": "selenium-java", "name": "Selenium WebDriver (Java)", "language": "java"},
            {"id": "selenium-python", "name": "Selenium WebDriver (Python)", "language": "python"},
            {"id": "selenium-csharp", "name": "Selenium WebDriver (C#)", "language": "csharp"},
            {"id": "cypress", "name": "Cypress", "language": "javascript"},
            {"id": "playwright-python", "name": "Playwright (Python)", "language": "python"},
            {"id": "playwright-typescript", "name": "Playwright (TypeScript)", "language": "typescript"},
            {"id": "testng", "name": "TestNG", "language": "java"},
            {"id": "junit", "name": "JUnit", "language": "java"},
            {"id": "pytest", "name": "PyTest", "language": "python"},
            {"id": "robot-framework", "name": "Robot Framework", "language": "robot"},
            {"id": "cucumber", "name": "Cucumber/BDD", "language": "gherkin"},
        ],
        "target_frameworks": [
            {"id": "playwright-python", "name": "Playwright (Python)", "recommended": True},
            {"id": "playwright-typescript", "name": "Playwright (TypeScript)", "recommended": True},
            {"id": "cypress", "name": "Cypress", "recommended": False},
            {"id": "selenium-python", "name": "Selenium (Python)", "recommended": False},
        ],
        "output_formats": [
            {"id": "requirements", "formats": ["markdown", "json", "html"]},
            {"id": "test_cases", "formats": ["istqb", "gherkin", "markdown", "json"]},
            {"id": "elements", "formats": ["json", "csv", "markdown"]},
            {"id": "coverage", "formats": ["markdown"]},
        ],
        "vcs_providers": [
            {"id": "github", "name": "GitHub", "url_pattern": "github.com/owner/repo", "auth_type": "token"},
            {"id": "gitlab", "name": "GitLab", "url_pattern": "gitlab.com/owner/repo", "auth_type": "token"},
            {"id": "bitbucket", "name": "Bitbucket", "url_pattern": "bitbucket.org/owner/repo", "auth_type": "app_password"},
            {"id": "azure-devops", "name": "Azure DevOps", "url_pattern": "dev.azure.com/org/project/_git/repo", "auth_type": "pat"},
        ],
        "input_methods": [
            {"id": "code", "name": "Code Snippet", "description": "Paste code directly"},
            {"id": "directory", "name": "Local Directory", "description": "Analyze local folder"},
            {"id": "upload", "name": "ZIP Upload", "description": "Upload ZIP file"},
            {"id": "vcs", "name": "Version Control", "description": "Import from GitHub, GitLab, Bitbucket, Azure DevOps"},
        ],
    }


# ==================== STORAGE (Simple in-memory for demo) ====================

_analysis_result_cache: Dict[str, Any] = {}


def _store_analysis_result(result):
    """Store analysis result for subsequent operations."""
    global _analysis_result_cache
    _analysis_result_cache["latest"] = result


def _get_stored_analysis_result():
    """Get stored analysis result."""
    return _analysis_result_cache.get("latest")

