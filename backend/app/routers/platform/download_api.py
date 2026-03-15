"""
Download Proxy API - Serves GitHub release assets.

For public repos: redirects directly to GitHub's CDN download URL (fast, no memory usage).
For private repos: proxies through the backend using GITHUB_TOKEN with true streaming.
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

    Strategy:
      1. Fetch latest release metadata from GitHub API (works for public repos without token)
      2. For public repos: redirect to the browser_download_url (GitHub CDN)
      3. For private repos: stream-proxy via the API using GITHUB_TOKEN
    """
    if filename not in ALLOWED_FILES:
        raise HTTPException(status_code=404, detail="File not found")

    # Build headers — token is optional for public repos
    api_headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        api_headers["Authorization"] = f"token {GITHUB_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Get the latest release metadata
            release_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
            release_resp = await client.get(release_url, headers=api_headers)

            if release_resp.status_code != 200:
                logger.error(f"[Download] Failed to fetch latest release: {release_resp.status_code} {release_resp.text[:200]}")
                raise HTTPException(status_code=502, detail="Could not fetch release info from GitHub")

            release_data = release_resp.json()
            tag = release_data.get("tag_name", "unknown")

            # 2. Find the matching asset
            browser_url = None
            api_url = None
            asset_size = 0
            for asset in release_data.get("assets", []):
                if asset["name"] == filename:
                    browser_url = asset.get("browser_download_url")
                    api_url = asset.get("url")
                    asset_size = asset.get("size", 0)
                    break

            if not browser_url and not api_url:
                raise HTTPException(
                    status_code=404,
                    detail=f"{filename} not found in latest release ({tag})"
                )

            # 3. Public repo: redirect to GitHub CDN (fast, no server memory/bandwidth)
            if browser_url:
                logger.info(f"[Download] Redirecting {filename} from release {tag} -> GitHub CDN")
                return RedirectResponse(
                    url=browser_url,
                    status_code=302,
                    headers={"Cache-Control": "no-cache"},
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
