"""
Version Control System Integration for Framework Analyzer

Supports:
- GitHub (public & private repos)
- GitLab (cloud & self-hosted)
- Bitbucket (cloud & server)
- Azure DevOps Repos
"""

import os
import re
import logging
import tempfile
import shutil
import asyncio
from typing import Dict, Any, Optional, List
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


class VCSProvider(str, Enum):
    """Supported VCS providers"""
    GITHUB = "github"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"
    AZURE_DEVOPS = "azure-devops"


@dataclass
class VCSCredentials:
    """Credentials for VCS authentication"""
    token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


@dataclass
class RepoInfo:
    """Parsed repository information"""
    provider: VCSProvider
    owner: str
    repo: str
    branch: str = "main"
    path: str = ""  # Specific path within repo
    is_private: bool = False


class VCSIntegration:
    """
    Handles downloading code from various VCS providers.
    """
    
    # URL patterns for detecting provider
    URL_PATTERNS = {
        VCSProvider.GITHUB: [
            r"github\.com/([^/]+)/([^/]+)",
            r"github\.com/([^/]+)/([^/]+)/tree/([^/]+)",
            r"github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.+)",
        ],
        VCSProvider.GITLAB: [
            r"gitlab\.com/([^/]+)/([^/]+)",
            r"gitlab\.com/([^/]+)/([^/]+)/-/tree/([^/]+)",
        ],
        VCSProvider.BITBUCKET: [
            r"bitbucket\.org/([^/]+)/([^/]+)",
            r"bitbucket\.org/([^/]+)/([^/]+)/src/([^/]+)",
        ],
        VCSProvider.AZURE_DEVOPS: [
            r"dev\.azure\.com/([^/]+)/([^/]+)/_git/([^/]+)",
            r"([^/]+)\.visualstudio\.com/([^/]+)/_git/([^/]+)",
        ],
    }
    
    def __init__(self, credentials: Dict[str, VCSCredentials] = None):
        """
        Initialize VCS integration.
        
        Args:
            credentials: Dict mapping provider name to credentials
        """
        self.credentials = credentials or {}
        
        # Load credentials from environment if not provided
        if VCSProvider.GITHUB not in self.credentials:
            github_token = os.getenv("GITHUB_TOKEN")
            if github_token:
                self.credentials[VCSProvider.GITHUB] = VCSCredentials(token=github_token)
        
        if VCSProvider.GITLAB not in self.credentials:
            gitlab_token = os.getenv("GITLAB_TOKEN")
            if gitlab_token:
                self.credentials[VCSProvider.GITLAB] = VCSCredentials(token=gitlab_token)
        
        if VCSProvider.BITBUCKET not in self.credentials:
            bb_user = os.getenv("BITBUCKET_USERNAME")
            bb_pass = os.getenv("BITBUCKET_APP_PASSWORD")
            if bb_user and bb_pass:
                self.credentials[VCSProvider.BITBUCKET] = VCSCredentials(
                    username=bb_user, password=bb_pass
                )
        
        if VCSProvider.AZURE_DEVOPS not in self.credentials:
            azure_token = os.getenv("AZURE_DEVOPS_PAT")
            if azure_token:
                self.credentials[VCSProvider.AZURE_DEVOPS] = VCSCredentials(token=azure_token)
    
    def parse_repo_url(self, url: str) -> Optional[RepoInfo]:
        """
        Parse a repository URL to extract provider and repo info.
        
        Args:
            url: Repository URL
            
        Returns:
            RepoInfo or None if URL not recognized
        """
        url = url.strip().rstrip('/')
        
        for provider, patterns in self.URL_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, url)
                if match:
                    groups = match.groups()
                    
                    if provider == VCSProvider.GITHUB:
                        owner = groups[0]
                        repo = groups[1].replace('.git', '')
                        branch = groups[2] if len(groups) > 2 else "main"
                        path = groups[3] if len(groups) > 3 else ""
                        return RepoInfo(
                            provider=provider,
                            owner=owner,
                            repo=repo,
                            branch=branch,
                            path=path,
                        )
                    
                    elif provider == VCSProvider.GITLAB:
                        owner = groups[0]
                        repo = groups[1].replace('.git', '')
                        branch = groups[2] if len(groups) > 2 else "main"
                        return RepoInfo(
                            provider=provider,
                            owner=owner,
                            repo=repo,
                            branch=branch,
                        )
                    
                    elif provider == VCSProvider.BITBUCKET:
                        owner = groups[0]
                        repo = groups[1].replace('.git', '')
                        branch = groups[2] if len(groups) > 2 else "main"
                        return RepoInfo(
                            provider=provider,
                            owner=owner,
                            repo=repo,
                            branch=branch,
                        )
                    
                    elif provider == VCSProvider.AZURE_DEVOPS:
                        if "visualstudio.com" in url:
                            org = groups[0]
                            project = groups[1]
                            repo = groups[2]
                        else:
                            org = groups[0]
                            project = groups[1]
                            repo = groups[2]
                        return RepoInfo(
                            provider=provider,
                            owner=f"{org}/{project}",
                            repo=repo,
                            branch="main",
                        )
        
        return None
    
    async def download_repo(
        self,
        url: str,
        branch: str = None,
        path: str = None,
        target_dir: str = None,
    ) -> str:
        """
        Download a repository to a local directory.
        
        Args:
            url: Repository URL
            branch: Branch to download (overrides URL branch)
            path: Specific path within repo to download
            target_dir: Target directory (creates temp if not provided)
            
        Returns:
            Path to downloaded repository
        """
        repo_info = self.parse_repo_url(url)
        if not repo_info:
            raise ValueError(f"Could not parse repository URL: {url}")
        
        if branch:
            repo_info.branch = branch
        if path:
            repo_info.path = path
        
        # Create target directory
        if not target_dir:
            target_dir = tempfile.mkdtemp(prefix="framework_analyzer_")
        
        target_path = Path(target_dir)
        target_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Downloading {repo_info.provider.value} repo: {repo_info.owner}/{repo_info.repo}")
        
        # Download based on provider
        if repo_info.provider == VCSProvider.GITHUB:
            await self._download_github(repo_info, target_path)
        elif repo_info.provider == VCSProvider.GITLAB:
            await self._download_gitlab(repo_info, target_path)
        elif repo_info.provider == VCSProvider.BITBUCKET:
            await self._download_bitbucket(repo_info, target_path)
        elif repo_info.provider == VCSProvider.AZURE_DEVOPS:
            await self._download_azure_devops(repo_info, target_path)
        
        return str(target_path)
    
    async def _download_github(self, repo_info: RepoInfo, target_path: Path):
        """Download from GitHub using the archive API."""
        creds = self.credentials.get(VCSProvider.GITHUB)
        headers = {}
        if creds and creds.token:
            headers["Authorization"] = f"token {creds.token}"
        
        # Use archive API for public repos, or git clone for private
        archive_url = f"https://api.github.com/repos/{repo_info.owner}/{repo_info.repo}/zipball/{repo_info.branch}"
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
            response = await client.get(archive_url, headers=headers)
            
            if response.status_code == 404:
                raise ValueError(f"Repository not found: {repo_info.owner}/{repo_info.repo}")
            elif response.status_code == 401:
                raise ValueError("Authentication required. Please provide a GitHub token.")
            elif response.status_code != 200:
                raise ValueError(f"Failed to download repository: {response.status_code}")
            
            # Save and extract zip
            zip_path = target_path / "repo.zip"
            zip_path.write_bytes(response.content)
            
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(target_path)
            
            # Move contents from nested folder to target
            extracted_dirs = [d for d in target_path.iterdir() if d.is_dir() and d.name != "__MACOSX"]
            if extracted_dirs:
                extracted_dir = extracted_dirs[0]
                for item in extracted_dir.iterdir():
                    shutil.move(str(item), str(target_path / item.name))
                extracted_dir.rmdir()
            
            zip_path.unlink()
        
        logger.info(f"Downloaded GitHub repo to {target_path}")
    
    async def _download_gitlab(self, repo_info: RepoInfo, target_path: Path):
        """Download from GitLab using the archive API."""
        creds = self.credentials.get(VCSProvider.GITLAB)
        headers = {}
        if creds and creds.token:
            headers["PRIVATE-TOKEN"] = creds.token
        
        # URL encode the project path
        import urllib.parse
        project_path = urllib.parse.quote(f"{repo_info.owner}/{repo_info.repo}", safe='')
        
        archive_url = f"https://gitlab.com/api/v4/projects/{project_path}/repository/archive.zip?sha={repo_info.branch}"
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
            response = await client.get(archive_url, headers=headers)
            
            if response.status_code == 404:
                raise ValueError(f"Repository not found: {repo_info.owner}/{repo_info.repo}")
            elif response.status_code == 401:
                raise ValueError("Authentication required. Please provide a GitLab token.")
            elif response.status_code != 200:
                raise ValueError(f"Failed to download repository: {response.status_code}")
            
            # Save and extract zip
            zip_path = target_path / "repo.zip"
            zip_path.write_bytes(response.content)
            
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(target_path)
            
            # Move contents from nested folder
            extracted_dirs = [d for d in target_path.iterdir() if d.is_dir()]
            if extracted_dirs:
                extracted_dir = extracted_dirs[0]
                for item in extracted_dir.iterdir():
                    shutil.move(str(item), str(target_path / item.name))
                extracted_dir.rmdir()
            
            zip_path.unlink()
        
        logger.info(f"Downloaded GitLab repo to {target_path}")
    
    async def _download_bitbucket(self, repo_info: RepoInfo, target_path: Path):
        """Download from Bitbucket using the downloads API."""
        creds = self.credentials.get(VCSProvider.BITBUCKET)
        auth = None
        if creds and creds.username and creds.password:
            auth = (creds.username, creds.password)
        
        archive_url = f"https://bitbucket.org/{repo_info.owner}/{repo_info.repo}/get/{repo_info.branch}.zip"
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0, auth=auth) as client:
            response = await client.get(archive_url)
            
            if response.status_code == 404:
                raise ValueError(f"Repository not found: {repo_info.owner}/{repo_info.repo}")
            elif response.status_code == 401:
                raise ValueError("Authentication required. Please provide Bitbucket credentials.")
            elif response.status_code != 200:
                raise ValueError(f"Failed to download repository: {response.status_code}")
            
            # Save and extract zip
            zip_path = target_path / "repo.zip"
            zip_path.write_bytes(response.content)
            
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(target_path)
            
            # Move contents from nested folder
            extracted_dirs = [d for d in target_path.iterdir() if d.is_dir()]
            if extracted_dirs:
                extracted_dir = extracted_dirs[0]
                for item in extracted_dir.iterdir():
                    shutil.move(str(item), str(target_path / item.name))
                extracted_dir.rmdir()
            
            zip_path.unlink()
        
        logger.info(f"Downloaded Bitbucket repo to {target_path}")
    
    async def _download_azure_devops(self, repo_info: RepoInfo, target_path: Path):
        """Download from Azure DevOps using the Items API."""
        creds = self.credentials.get(VCSProvider.AZURE_DEVOPS)
        headers = {}
        if creds and creds.token:
            import base64
            auth_str = base64.b64encode(f":{creds.token}".encode()).decode()
            headers["Authorization"] = f"Basic {auth_str}"
        
        # Parse org and project from owner
        parts = repo_info.owner.split('/')
        org = parts[0]
        project = parts[1] if len(parts) > 1 else parts[0]
        
        # Azure DevOps Items API for downloading
        archive_url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo_info.repo}/items?path=/&versionDescriptor[version]={repo_info.branch}&$format=zip&api-version=7.0"
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
            response = await client.get(archive_url, headers=headers)
            
            if response.status_code == 404:
                raise ValueError(f"Repository not found: {repo_info.owner}/{repo_info.repo}")
            elif response.status_code == 401:
                raise ValueError("Authentication required. Please provide an Azure DevOps PAT.")
            elif response.status_code != 200:
                raise ValueError(f"Failed to download repository: {response.status_code}")
            
            # Save and extract zip
            zip_path = target_path / "repo.zip"
            zip_path.write_bytes(response.content)
            
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(target_path)
            
            zip_path.unlink()
        
        logger.info(f"Downloaded Azure DevOps repo to {target_path}")
    
    async def list_branches(self, url: str) -> List[str]:
        """
        List available branches for a repository.
        
        Args:
            url: Repository URL
            
        Returns:
            List of branch names
        """
        repo_info = self.parse_repo_url(url)
        if not repo_info:
            raise ValueError(f"Could not parse repository URL: {url}")
        
        if repo_info.provider == VCSProvider.GITHUB:
            return await self._list_github_branches(repo_info)
        elif repo_info.provider == VCSProvider.GITLAB:
            return await self._list_gitlab_branches(repo_info)
        elif repo_info.provider == VCSProvider.BITBUCKET:
            return await self._list_bitbucket_branches(repo_info)
        elif repo_info.provider == VCSProvider.AZURE_DEVOPS:
            return await self._list_azure_devops_branches(repo_info)
        
        return []
    
    async def _list_github_branches(self, repo_info: RepoInfo) -> List[str]:
        """List branches from GitHub."""
        creds = self.credentials.get(VCSProvider.GITHUB)
        headers = {}
        if creds and creds.token:
            headers["Authorization"] = f"token {creds.token}"
        
        url = f"https://api.github.com/repos/{repo_info.owner}/{repo_info.repo}/branches"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                branches = response.json()
                return [b["name"] for b in branches]
        
        return ["main", "master"]
    
    async def _list_gitlab_branches(self, repo_info: RepoInfo) -> List[str]:
        """List branches from GitLab."""
        creds = self.credentials.get(VCSProvider.GITLAB)
        headers = {}
        if creds and creds.token:
            headers["PRIVATE-TOKEN"] = creds.token
        
        import urllib.parse
        project_path = urllib.parse.quote(f"{repo_info.owner}/{repo_info.repo}", safe='')
        url = f"https://gitlab.com/api/v4/projects/{project_path}/repository/branches"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                branches = response.json()
                return [b["name"] for b in branches]
        
        return ["main", "master"]
    
    async def _list_bitbucket_branches(self, repo_info: RepoInfo) -> List[str]:
        """List branches from Bitbucket."""
        creds = self.credentials.get(VCSProvider.BITBUCKET)
        auth = None
        if creds and creds.username and creds.password:
            auth = (creds.username, creds.password)
        
        url = f"https://api.bitbucket.org/2.0/repositories/{repo_info.owner}/{repo_info.repo}/refs/branches"
        
        async with httpx.AsyncClient(timeout=30.0, auth=auth) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                return [b["name"] for b in data.get("values", [])]
        
        return ["main", "master"]
    
    async def _list_azure_devops_branches(self, repo_info: RepoInfo) -> List[str]:
        """List branches from Azure DevOps."""
        creds = self.credentials.get(VCSProvider.AZURE_DEVOPS)
        headers = {}
        if creds and creds.token:
            import base64
            auth_str = base64.b64encode(f":{creds.token}".encode()).decode()
            headers["Authorization"] = f"Basic {auth_str}"
        
        parts = repo_info.owner.split('/')
        org = parts[0]
        project = parts[1] if len(parts) > 1 else parts[0]
        
        url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo_info.repo}/refs?filter=heads/&api-version=7.0"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                return [ref["name"].replace("refs/heads/", "") for ref in data.get("value", [])]
        
        return ["main", "master"]
    
    def cleanup(self, directory: str):
        """Clean up a downloaded repository directory."""
        try:
            shutil.rmtree(directory, ignore_errors=True)
            logger.info(f"Cleaned up directory: {directory}")
        except Exception as e:
            logger.warning(f"Failed to clean up directory {directory}: {e}")


# Singleton instance
_vcs_integration: Optional[VCSIntegration] = None


def get_vcs_integration() -> VCSIntegration:
    """Get or create the VCS integration singleton."""
    global _vcs_integration
    if _vcs_integration is None:
        _vcs_integration = VCSIntegration()
    return _vcs_integration

