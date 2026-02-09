"""
Download Proxy API - Serves GitHub release assets for private repos.

Since the GitHub repo is private, release asset download URLs require authentication.
This endpoint proxies the download so users can download installers without a GitHub account.
"""

import os
import httpx
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/download", tags=["download"])

# GitHub repo details
GITHUB_OWNER = "maddynolan"
GITHUB_REPO = "QAOne"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Allowed filenames (prevent arbitrary file access)
ALLOWED_FILES = {
    "Flowstral-Setup.exe",
    "Flowstral-Portable.exe",
    "latest.yml",
}


@router.get("/{filename}")
async def download_release_asset(filename: str):
    """
    Download a release asset from the latest GitHub release.
    
    Proxies the download from the private GitHub repo so users
    don't need a GitHub account to download the installer.
    """
    if filename not in ALLOWED_FILES:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not GITHUB_TOKEN:
        raise HTTPException(
            status_code=503, 
            detail="Download service not configured. Set GITHUB_TOKEN env var."
        )
    
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get the latest release
            release_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
            release_resp = await client.get(release_url, headers=headers)
            
            if release_resp.status_code != 200:
                logger.error(f"[Download] Failed to fetch latest release: {release_resp.status_code}")
                raise HTTPException(status_code=502, detail="Could not fetch release info from GitHub")
            
            release_data = release_resp.json()
            
            # Find the matching asset
            asset_url = None
            asset_size = 0
            for asset in release_data.get("assets", []):
                if asset["name"] == filename:
                    asset_url = asset["url"]  # API URL (not browser URL)
                    asset_size = asset["size"]
                    break
            
            if not asset_url:
                raise HTTPException(
                    status_code=404, 
                    detail=f"{filename} not found in latest release ({release_data.get('tag_name', 'unknown')})"
                )
            
            # Stream the asset download
            download_headers = {
                "Authorization": f"token {GITHUB_TOKEN}",
                "Accept": "application/octet-stream",
            }
            
            # Use follow_redirects since GitHub API redirects to the actual download URL
            asset_resp = await client.get(
                asset_url, 
                headers=download_headers, 
                follow_redirects=True
            )
            
            if asset_resp.status_code != 200:
                logger.error(f"[Download] Failed to download asset: {asset_resp.status_code}")
                raise HTTPException(status_code=502, detail="Could not download file from GitHub")
            
            # Determine content type
            content_type = "application/octet-stream"
            if filename.endswith(".yml"):
                content_type = "text/yaml"
            elif filename.endswith(".exe"):
                content_type = "application/x-msdownload"
            
            return StreamingResponse(
                iter([asset_resp.content]),
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Length": str(len(asset_resp.content)),
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Download] Error: {e}")
        raise HTTPException(status_code=500, detail="Download failed")


@router.get("/")
async def download_info():
    """List available downloads."""
    return {
        "available": list(ALLOWED_FILES),
        "usage": "GET /api/download/{filename}",
        "example": "/api/download/Flowstral-Setup.exe"
    }
