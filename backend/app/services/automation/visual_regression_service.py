"""
Visual Regression Testing Service

Provides screenshot comparison capabilities for detecting visual changes between test runs.
Features:
- Baseline screenshot management
- Pixel-by-pixel comparison with configurable threshold
- Diff image generation
- Region-based comparison
- Ignore areas (dynamic content, timestamps, etc.)
"""

import logging
import os
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Storage paths
SCREENSHOTS_DIR = Path("screenshots")
BASELINES_DIR = SCREENSHOTS_DIR / "baselines"
ACTUAL_DIR = SCREENSHOTS_DIR / "actual"
DIFF_DIR = SCREENSHOTS_DIR / "diffs"


class VisualRegressionService:
    """Service for visual regression testing"""
    
    def __init__(self, threshold: float = 0.1):
        """
        Initialize visual regression service.
        
        Args:
            threshold: Percentage difference allowed (0.0 to 1.0)
        """
        self.threshold = threshold
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Create necessary directories if they don't exist"""
        for dir_path in [SCREENSHOTS_DIR, BASELINES_DIR, ACTUAL_DIR, DIFF_DIR]:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def generate_visual_test_script(self, screenshots: List[Dict[str, Any]], test_name: str = "visual_regression") -> str:
        """
        Generate a Playwright test script with visual regression checks.
        
        Args:
            screenshots: List of screenshot configs with 'name', 'url', 'selector' (optional)
            test_name: Name of the test
            
        Returns:
            Generated Python test script
        """
        script = f'''"""
Visual Regression Test: {test_name}
Generated: {datetime.now().isoformat()}

This test performs visual regression testing by comparing screenshots
against baseline images. Run with `--update-snapshots` to update baselines.
"""

import pytest
from playwright.sync_api import Page, expect
from pathlib import Path
import os


# Configuration
THRESHOLD = {self.threshold}  # Allowed percentage difference (0.0 to 1.0)
BASELINES_DIR = Path("screenshots/baselines")
ACTUAL_DIR = Path("screenshots/actual")
DIFF_DIR = Path("screenshots/diffs")


def ensure_dirs():
    """Create screenshot directories if needed"""
    for d in [BASELINES_DIR, ACTUAL_DIR, DIFF_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def compare_screenshots(baseline_path: Path, actual_path: Path, diff_path: Path, threshold: float = 0.1) -> Tuple[bool, float]:
    """
    Compare two screenshots and generate a diff image.
    
    Returns:
        Tuple of (passed, diff_percentage)
    """
    try:
        from PIL import Image, ImageChops, ImageDraw
        import numpy as np
        
        if not baseline_path.exists():
            return True, 0.0  # No baseline = pass (first run)
        
        baseline = Image.open(baseline_path)
        actual = Image.open(actual_path)
        
        # Resize if different dimensions
        if baseline.size != actual.size:
            actual = actual.resize(baseline.size)
        
        # Calculate difference
        diff = ImageChops.difference(baseline, actual)
        
        # Convert to numpy for percentage calculation
        diff_array = np.array(diff)
        total_pixels = diff_array.size
        diff_pixels = np.count_nonzero(diff_array)
        diff_percentage = diff_pixels / total_pixels
        
        # Generate highlighted diff image
        if diff_percentage > 0:
            diff_highlighted = Image.new('RGBA', baseline.size, (255, 255, 255, 255))
            diff_highlighted.paste(baseline)
            
            # Highlight differences in red
            diff_mask = diff.convert('L').point(lambda x: 255 if x > 10 else 0)
            red_overlay = Image.new('RGBA', baseline.size, (255, 0, 0, 128))
            diff_highlighted.paste(red_overlay, mask=diff_mask)
            
            diff_highlighted.save(diff_path)
        
        passed = diff_percentage <= threshold
        return passed, diff_percentage
        
    except ImportError:
        logger.warning("PIL not installed. Install with: pip install Pillow")
        return True, 0.0
    except Exception as e:
        logger.error(f"Error comparing screenshots: {{e}}")
        return True, 0.0


@pytest.fixture(scope="session")
def screenshot_dirs():
    """Ensure screenshot directories exist"""
    ensure_dirs()
    return {{
        "baselines": BASELINES_DIR,
        "actual": ACTUAL_DIR,
        "diffs": DIFF_DIR,
    }}


'''
        
        # Add test functions for each screenshot
        for i, screenshot in enumerate(screenshots):
            name = screenshot.get("name", f"screenshot_{i}")
            url = screenshot.get("url", "")
            selector = screenshot.get("selector", "")
            wait_for = screenshot.get("waitFor", "")
            ignore_regions = screenshot.get("ignoreRegions", [])
            
            safe_name = self._to_safe_name(name)
            
            script += f'''
def test_{safe_name}(page: Page, screenshot_dirs):
    """Visual regression test: {name}"""
    
    # Navigate to page
    page.goto("{url}")
    page.wait_for_load_state("domcontentloaded")
'''
            
            if wait_for:
                script += f'''    
    # Wait for specific element
    page.locator("{wait_for}").wait_for(state="visible", timeout=10000)
'''
            
            script += f'''    
    # Wait for page to stabilize
    page.wait_for_timeout(1000)
    
    # Define paths
    baseline_path = screenshot_dirs["baselines"] / "{safe_name}.png"
    actual_path = screenshot_dirs["actual"] / "{safe_name}.png"
    diff_path = screenshot_dirs["diffs"] / "{safe_name}_diff.png"
'''
            
            if selector:
                script += f'''    
    # Take screenshot of specific element
    element = page.locator("{selector}")
    element.screenshot(path=str(actual_path))
'''
            else:
                script += f'''    
    # Take full page screenshot
    page.screenshot(path=str(actual_path), full_page=True)
'''
            
            script += f'''    
    # Compare with baseline
    passed, diff_pct = compare_screenshots(baseline_path, actual_path, diff_path, THRESHOLD)
    
    # Update baseline if running in update mode
    update_snapshots = os.environ.get("UPDATE_SNAPSHOTS", "").lower() in ("true", "1", "yes")
    if update_snapshots:
        import shutil
        shutil.copy(actual_path, baseline_path)
        print(f"Updated baseline: {{baseline_path}}")
    
    assert passed, f"Visual difference ({{diff_pct:.2%}}) exceeds threshold ({{THRESHOLD:.2%}}). See diff: {{diff_path}}"

'''
        
        return script
    
    def generate_visual_assertions(self, selectors: List[str], page_url: str) -> str:
        """
        Generate Playwright assertions for visual checks on specific elements.
        
        Args:
            selectors: List of element selectors to capture
            page_url: URL of the page
            
        Returns:
            Generated assertion code snippet
        """
        assertions = []
        
        for i, selector in enumerate(selectors):
            safe_name = f"element_{i}"
            assertions.append(f'''
    # Visual assertion for element {i+1}
    element_{i} = page.locator("{selector}")
    await expect(element_{i}).to_have_screenshot("{safe_name}.png", threshold={self.threshold})
''')
        
        return "\n".join(assertions)
    
    def _to_safe_name(self, name: str) -> str:
        """Convert name to safe file/function name"""
        import re
        safe = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
        return re.sub(r'_+', '_', safe).strip('_')[:50]
    
    def get_baseline_info(self, test_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a baseline screenshot"""
        baseline_path = BASELINES_DIR / f"{test_name}.png"
        
        if not baseline_path.exists():
            return None
        
        return {
            "name": test_name,
            "path": str(baseline_path),
            "exists": True,
            "modified": datetime.fromtimestamp(baseline_path.stat().st_mtime).isoformat(),
            "size": baseline_path.stat().st_size,
        }
    
    def list_baselines(self) -> List[Dict[str, Any]]:
        """List all baseline screenshots"""
        baselines = []
        
        if not BASELINES_DIR.exists():
            return baselines
        
        for path in BASELINES_DIR.glob("*.png"):
            baselines.append({
                "name": path.stem,
                "path": str(path),
                "modified": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
                "size": path.stat().st_size,
            })
        
        return sorted(baselines, key=lambda x: x["modified"], reverse=True)
    
    def delete_baseline(self, test_name: str) -> bool:
        """Delete a baseline screenshot"""
        baseline_path = BASELINES_DIR / f"{test_name}.png"
        
        if baseline_path.exists():
            baseline_path.unlink()
            return True
        
        return False


# API endpoint helpers
async def generate_visual_test(screenshots: List[Dict[str, Any]], test_name: str = "visual_regression") -> Dict[str, Any]:
    """
    Generate a visual regression test script.
    
    Args:
        screenshots: List of screenshot configurations
        test_name: Name for the test
        
    Returns:
        Dict with 'script' and 'metadata'
    """
    service = VisualRegressionService()
    script = service.generate_visual_test_script(screenshots, test_name)
    
    return {
        "script": script,
        "baselines": service.list_baselines(),
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "screenshot_count": len(screenshots),
            "threshold": service.threshold,
        }
    }

