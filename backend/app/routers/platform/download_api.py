"""
Download Proxy API - Serves GitHub release assets.

Works for both public and private repos:
  - Public repo: redirects to GitHub CDN (fast, zero server load)
  - Private repo: streams asset through the backend using GITHUB_TOKEN
    (set GITHUB_TOKEN env var with repo scope)
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

# Content types
CONTENT_TYPES = {
    ".exe": "application/x-msdownload",
    ".yml": "text/yaml",
    ".yaml": "text/yaml",
}


async def _get_latest_release_asset(filename: str, api_headers: dict):
    """Fetch latest release metadata and find the named asset."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        release_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
        release_resp = await client.get(release_url, headers=api_headers)

        if release_resp.status_code != 200:
            logger.error(f"[Download] GitHub API {release_resp.status_code}: {release_resp.text[:200]}")
            raise HTTPException(status_code=502, detail="Could not fetch release info from GitHub")

        release_data = release_resp.json()
        tag = release_data.get("tag_name", "unknown")

        for asset in release_data.get("assets", []):
            if asset["name"] == filename:
                return {
                    "tag": tag,
                    "browser_download_url": asset.get("browser_download_url"),
                    "api_url": asset.get("url"),
                    "size": asset.get("size", 0),
                }

        raise HTTPException(
            status_code=404,
            detail=f"{filename} not found in latest release ({tag})"
        )


@router.get("/{filename}")
async def download_release_asset(filename: str):
    """
    Download a release asset from the latest GitHub release.

    Strategy:
      1. Fetch latest release metadata from GitHub API
      2. If repo is public (browser_download_url works): redirect to GitHub CDN
      3. If repo is private (needs auth): stream-proxy via GitHub API with GITHUB_TOKEN
    """
    if filename not in ALLOWED_FILES:
        raise HTTPException(status_code=404, detail="File not found")

    # Build headers — token is optional for public repos
    api_headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        api_headers["Authorization"] = f"token {GITHUB_TOKEN}"

    try:
        asset_info = await _get_latest_release_asset(filename, api_headers)
        tag = asset_info["tag"]
        browser_url = asset_info["browser_download_url"]
        api_url = asset_info["api_url"]
        asset_size = asset_info["size"]

        # Determine content type from file extension
        ext = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""
        content_type = CONTENT_TYPES.get(ext, "application/octet-stream")

        # --- Strategy A: Redirect to GitHub CDN (public repos) ---
        # Try the redirect first. If the repo is public, this URL works directly.
        # If the repo is private AND we have a token, we fall through to streaming.
        if browser_url and not GITHUB_TOKEN:
            # Public repo — redirect is the fastest path
            logger.info(f"[Download] Redirect {filename} ({tag}) -> GitHub CDN")
            return RedirectResponse(url=browser_url, status_code=302)

        if browser_url and GITHUB_TOKEN:
            # We have a token but the repo might be public. Still redirect — if it
            # fails (private repo), the user would get a 404 from GitHub. To be safe,
            # test accessibility first with a HEAD request.
            async with httpx.AsyncClient(timeout=10.0) as client:
                head_resp = await client.head(browser_url, follow_redirects=True)
                if head_resp.status_code == 200:
                    logger.info(f"[Download] Redirect {filename} ({tag}) -> GitHub CDN (public)")
                    return RedirectResponse(url=browser_url, status_code=302)
                # Fall through to streaming proxy for private repos

        # --- Strategy B: Stream-proxy through backend (private repos) ---
        if not GITHUB_TOKEN:
            raise HTTPException(
                status_code=503,
                detail="Download service not configured. Set GITHUB_TOKEN env var for private repo downloads."
            )

        if not api_url:
            raise HTTPException(status_code=404, detail=f"{filename} not found in release {tag}")

        logger.info(f"[Download] Streaming {filename} ({tag}, {asset_size} bytes) via proxy")

        download_headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/octet-stream",
        }

        # Stream the file in chunks (never load full file into memory)
        async def _stream_asset():
            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as client:
                async with client.stream(
                    "GET", api_url, headers=download_headers, follow_redirects=True
                ) as resp:
                    if resp.status_code != 200:
                        logger.error(f"[Download] GitHub stream returned {resp.status_code}")
                        return
                    async for chunk in resp.aiter_bytes(chunk_size=65536):
                        yield chunk

        response_headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
        }
        if asset_size > 0:
            response_headers["Content-Length"] = str(asset_size)

        return StreamingResponse(
            _stream_asset(),
            media_type=content_type,
            headers=response_headers,
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
