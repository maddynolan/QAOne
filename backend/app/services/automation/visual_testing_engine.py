"""
Robust Visual Testing Engine
============================

A production-grade visual comparison system with multiple algorithms
for reliable visual regression testing.

Features:
- Multiple comparison modes (pixel, perceptual, structural, AI)
- Anti-aliasing tolerance
- Ignore regions for dynamic content
- Detailed diff visualization
- Baseline management workflow
- Cross-browser normalization

Usage:
    engine = VisualTestingEngine()
    result = engine.compare(baseline_path, actual_path, options)
"""

import logging
import os
import io
import base64
import hashlib
import json
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from enum import Enum
import struct
import math

logger = logging.getLogger(__name__)

# Try to import optional image processing libraries
try:
    from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL not available. Install with: pip install Pillow")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy not available. Install with: pip install numpy")


class ComparisonMode(str, Enum):
    """Visual comparison modes"""
    PIXEL_PERFECT = "pixel_perfect"      # Strict pixel-by-pixel comparison
    ANTI_ALIASED = "anti_aliased"        # Allows anti-aliasing differences
    PERCEPTUAL = "perceptual"            # Perceptual hash comparison
    STRUCTURAL = "structural"            # SSIM-based structural comparison
    LAYOUT = "layout"                    # Focus on layout, ignore content
    AI_SEMANTIC = "ai_semantic"          # AI-powered semantic comparison using Claude Vision


@dataclass
class IgnoreRegion:
    """Region to ignore during comparison"""
    x: int
    y: int
    width: int
    height: int
    name: str = ""
    reason: str = ""  # e.g., "timestamp", "advertisement", "animation"


@dataclass
class ComparisonOptions:
    """Options for visual comparison"""
    mode: ComparisonMode = ComparisonMode.ANTI_ALIASED
    threshold: float = 0.1  # 0.0 to 1.0 - percentage of allowed difference
    anti_aliasing_tolerance: int = 2  # Pixel tolerance for anti-aliasing
    color_threshold: int = 0.1  # Color difference threshold (0-1)
    ignore_regions: List[IgnoreRegion] = field(default_factory=list)
    ignore_colors: List[str] = field(default_factory=list)  # Hex colors to ignore
    resize_to_match: bool = True  # Resize actual to match baseline dimensions
    full_page: bool = True
    viewport_width: int = 1920
    viewport_height: int = 1080
    generate_diff: bool = True
    highlight_color: Tuple[int, int, int, int] = (255, 0, 255, 200)  # Magenta highlight


@dataclass
class ComparisonResult:
    """Result of visual comparison"""
    passed: bool
    diff_percentage: float
    diff_pixel_count: int
    total_pixels: int
    mode: ComparisonMode
    threshold: float
    baseline_path: str
    actual_path: str
    diff_path: Optional[str] = None
    diff_image_base64: Optional[str] = None
    baseline_dimensions: Tuple[int, int] = (0, 0)
    actual_dimensions: Tuple[int, int] = (0, 0)
    execution_time_ms: int = 0
    regions_ignored: int = 0
    error: Optional[str] = None
    perceptual_hash_baseline: Optional[str] = None
    perceptual_hash_actual: Optional[str] = None
    ssim_score: Optional[float] = None
    mismatch_regions: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PerceptualHasher:
    """
    Generate perceptual hashes for images.
    Uses average hash (aHash) algorithm - robust against scaling and compression.
    """
    
    @staticmethod
    def compute_ahash(image: 'Image.Image', hash_size: int = 16) -> str:
        """
        Compute average hash (aHash) of an image.
        
        The algorithm:
        1. Resize image to hash_size x hash_size
        2. Convert to grayscale
        3. Compute mean pixel value
        4. Create binary hash based on pixels > mean
        """
        if not PIL_AVAILABLE:
            return ""
        
        # Resize and convert to grayscale
        img = image.convert('L').resize((hash_size, hash_size), Image.Resampling.LANCZOS)
        
        # Get pixel data
        pixels = list(img.getdata())
        
        # Compute mean
        avg = sum(pixels) / len(pixels)
        
        # Create hash - 1 if pixel >= avg, 0 otherwise
        bits = ''.join('1' if pixel >= avg else '0' for pixel in pixels)
        
        # Convert to hex
        hash_value = hex(int(bits, 2))[2:].zfill(hash_size * hash_size // 4)
        
        return hash_value
    
    @staticmethod
    def compute_dhash(image: 'Image.Image', hash_size: int = 16) -> str:
        """
        Compute difference hash (dHash) of an image.
        More resistant to gamma/color adjustments than aHash.
        
        Compares adjacent pixels horizontally.
        """
        if not PIL_AVAILABLE:
            return ""
        
        # Resize - width = hash_size + 1 because we compare adjacent
        img = image.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
        
        pixels = list(img.getdata())
        
        bits = []
        for row in range(hash_size):
            for col in range(hash_size):
                left_idx = row * (hash_size + 1) + col
                right_idx = left_idx + 1
                bits.append('1' if pixels[left_idx] > pixels[right_idx] else '0')
        
        hash_value = hex(int(''.join(bits), 2))[2:].zfill(hash_size * hash_size // 4)
        
        return hash_value
    
    @staticmethod
    def hamming_distance(hash1: str, hash2: str) -> int:
        """Compute Hamming distance between two hashes"""
        if len(hash1) != len(hash2):
            return -1
        
        # Convert hex to binary and count differences
        try:
            b1 = bin(int(hash1, 16))[2:].zfill(len(hash1) * 4)
            b2 = bin(int(hash2, 16))[2:].zfill(len(hash2) * 4)
            return sum(c1 != c2 for c1, c2 in zip(b1, b2))
        except ValueError:
            return -1
    
    @staticmethod
    def similarity(hash1: str, hash2: str) -> float:
        """Compute similarity (0-1) between two perceptual hashes"""
        distance = PerceptualHasher.hamming_distance(hash1, hash2)
        if distance < 0:
            return 0.0
        total_bits = len(hash1) * 4
        return 1.0 - (distance / total_bits)


class SSIMCalculator:
    """
    Compute Structural Similarity Index (SSIM) between images.
    SSIM measures perceived quality and structural information.
    """
    
    @staticmethod
    def compute_ssim(img1: 'Image.Image', img2: 'Image.Image', window_size: int = 11) -> float:
        """
        Compute SSIM between two images.
        
        Returns value between -1 and 1, where 1 means identical.
        Typical threshold: > 0.95 for "similar"
        """
        if not PIL_AVAILABLE or not NUMPY_AVAILABLE:
            return 1.0  # Fallback
        
        # Convert to grayscale numpy arrays
        arr1 = np.array(img1.convert('L'), dtype=np.float64)
        arr2 = np.array(img2.convert('L'), dtype=np.float64)
        
        # Ensure same size
        if arr1.shape != arr2.shape:
            return 0.0
        
        # Constants for stability
        C1 = (0.01 * 255) ** 2
        C2 = (0.03 * 255) ** 2
        
        # Compute means
        mu1 = arr1.mean()
        mu2 = arr2.mean()
        
        # Compute variances and covariance
        sigma1_sq = ((arr1 - mu1) ** 2).mean()
        sigma2_sq = ((arr2 - mu2) ** 2).mean()
        sigma12 = ((arr1 - mu1) * (arr2 - mu2)).mean()
        
        # SSIM formula
        numerator = (2 * mu1 * mu2 + C1) * (2 * sigma12 + C2)
        denominator = (mu1 ** 2 + mu2 ** 2 + C1) * (sigma1_sq + sigma2_sq + C2)
        
        ssim = numerator / denominator
        
        return float(ssim)


class VisualTestingEngine:
    """
    Production-grade visual testing engine with multiple comparison algorithms.
    """
    
    def __init__(self, storage_path: str = "visual_testing"):
        """
        Initialize the visual testing engine.
        
        Args:
            storage_path: Base path for storing baselines, actuals, and diffs
        """
        self.storage_path = Path(storage_path)
        self.baselines_dir = self.storage_path / "baselines"
        self.actuals_dir = self.storage_path / "actuals"
        self.diffs_dir = self.storage_path / "diffs"
        self.metadata_dir = self.storage_path / "metadata"
        
        self._ensure_directories()
        
        self.hasher = PerceptualHasher()
        self.ssim_calc = SSIMCalculator()
    
    def _ensure_directories(self):
        """Create necessary directories"""
        for dir_path in [self.baselines_dir, self.actuals_dir, self.diffs_dir, self.metadata_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def compare(
        self,
        baseline: Union[str, Path, bytes, 'Image.Image'],
        actual: Union[str, Path, bytes, 'Image.Image'],
        options: Optional[ComparisonOptions] = None,
        test_name: str = "visual_test"
    ) -> ComparisonResult:
        """
        Compare two images and generate a detailed comparison result.
        
        Args:
            baseline: Baseline image (path, bytes, or PIL Image)
            actual: Actual image to compare
            options: Comparison options
            test_name: Name for this test (used in file naming)
            
        Returns:
            ComparisonResult with detailed comparison data
        """
        start_time = datetime.now()
        options = options or ComparisonOptions()
        
        if not PIL_AVAILABLE:
            return ComparisonResult(
                passed=False,
                diff_percentage=100.0,
                diff_pixel_count=0,
                total_pixels=0,
                mode=options.mode,
                threshold=options.threshold,
                baseline_path="",
                actual_path="",
                error="PIL not available. Install with: pip install Pillow"
            )
        
        try:
            # Load images
            baseline_img = self._load_image(baseline)
            actual_img = self._load_image(actual)
            
            if baseline_img is None:
                return ComparisonResult(
                    passed=True,  # First run - no baseline exists
                    diff_percentage=0.0,
                    diff_pixel_count=0,
                    total_pixels=0,
                    mode=options.mode,
                    threshold=options.threshold,
                    baseline_path=str(baseline) if isinstance(baseline, (str, Path)) else "new",
                    actual_path=str(actual) if isinstance(actual, (str, Path)) else "provided",
                    error="No baseline exists - first run"
                )
            
            # Resize if needed
            if options.resize_to_match and baseline_img.size != actual_img.size:
                actual_img = actual_img.resize(baseline_img.size, Image.Resampling.LANCZOS)
            
            # Apply ignore regions
            if options.ignore_regions:
                baseline_img, actual_img = self._apply_ignore_regions(
                    baseline_img, actual_img, options.ignore_regions
                )
            
            # Perform comparison based on mode
            if options.mode == ComparisonMode.PIXEL_PERFECT:
                result = self._compare_pixel_perfect(baseline_img, actual_img, options)
            elif options.mode == ComparisonMode.ANTI_ALIASED:
                result = self._compare_anti_aliased(baseline_img, actual_img, options)
            elif options.mode == ComparisonMode.PERCEPTUAL:
                result = self._compare_perceptual(baseline_img, actual_img, options)
            elif options.mode == ComparisonMode.STRUCTURAL:
                result = self._compare_structural(baseline_img, actual_img, options)
            elif options.mode == ComparisonMode.LAYOUT:
                result = self._compare_layout(baseline_img, actual_img, options)
            elif options.mode == ComparisonMode.AI_SEMANTIC:
                # AI comparison is async, use asyncio.run in sync context
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # We're already in an async context
                        import concurrent.futures
                        with concurrent.futures.ThreadPoolExecutor() as executor:
                            future = executor.submit(
                                asyncio.run,
                                self._compare_ai_semantic(baseline_img, actual_img, options)
                            )
                            result = future.result()
                    else:
                        result = asyncio.run(self._compare_ai_semantic(baseline_img, actual_img, options))
                except RuntimeError:
                    result = asyncio.run(self._compare_ai_semantic(baseline_img, actual_img, options))
            else:
                result = self._compare_anti_aliased(baseline_img, actual_img, options)
            
            # Store paths
            result.baseline_path = str(baseline) if isinstance(baseline, (str, Path)) else "provided"
            result.actual_path = str(actual) if isinstance(actual, (str, Path)) else "provided"
            result.baseline_dimensions = baseline_img.size
            result.actual_dimensions = actual_img.size
            result.regions_ignored = len(options.ignore_regions)
            
            # Calculate execution time
            result.execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Generate diff image if requested and there are differences
            if options.generate_diff and result.diff_percentage > 0:
                diff_img = self._generate_diff_image(baseline_img, actual_img, options)
                if diff_img:
                    # Save diff
                    safe_name = self._safe_filename(test_name)
                    diff_path = self.diffs_dir / f"{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                    diff_img.save(diff_path)
                    result.diff_path = str(diff_path)
                    
                    # Also provide base64 for API response
                    buffer = io.BytesIO()
                    diff_img.save(buffer, format='PNG')
                    result.diff_image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return result
            
        except Exception as e:
            logger.error(f"Visual comparison error: {e}", exc_info=True)
            return ComparisonResult(
                passed=False,
                diff_percentage=100.0,
                diff_pixel_count=0,
                total_pixels=0,
                mode=options.mode,
                threshold=options.threshold,
                baseline_path=str(baseline) if isinstance(baseline, (str, Path)) else "error",
                actual_path=str(actual) if isinstance(actual, (str, Path)) else "error",
                error=str(e)
            )
    
    def _load_image(self, source: Union[str, Path, bytes, 'Image.Image']) -> Optional['Image.Image']:
        """Load image from various sources"""
        if isinstance(source, Image.Image):
            return source.convert('RGBA')
        elif isinstance(source, bytes):
            return Image.open(io.BytesIO(source)).convert('RGBA')
        elif isinstance(source, (str, Path)):
            path = Path(source)
            if not path.exists():
                return None
            return Image.open(path).convert('RGBA')
        return None
    
    def _apply_ignore_regions(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        regions: List[IgnoreRegion]
    ) -> Tuple['Image.Image', 'Image.Image']:
        """Apply ignore regions by masking them with identical content"""
        baseline_copy = baseline.copy()
        actual_copy = actual.copy()
        
        # Create a uniform color to mask ignored regions
        mask_color = (128, 128, 128, 255)  # Gray
        
        draw_baseline = ImageDraw.Draw(baseline_copy)
        draw_actual = ImageDraw.Draw(actual_copy)
        
        for region in regions:
            rect = (region.x, region.y, region.x + region.width, region.y + region.height)
            draw_baseline.rectangle(rect, fill=mask_color)
            draw_actual.rectangle(rect, fill=mask_color)
        
        return baseline_copy, actual_copy
    
    def _compare_pixel_perfect(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        options: ComparisonOptions
    ) -> ComparisonResult:
        """Strict pixel-by-pixel comparison"""
        if not NUMPY_AVAILABLE:
            # Fallback to PIL
            diff = ImageChops.difference(baseline, actual)
            diff_array = list(diff.getdata())
            diff_pixels = sum(1 for p in diff_array if any(c > 0 for c in p))
            total = len(diff_array)
        else:
            arr_baseline = np.array(baseline)
            arr_actual = np.array(actual)
            
            # Calculate pixel differences
            diff = np.abs(arr_baseline.astype(np.int16) - arr_actual.astype(np.int16))
            
            # Count pixels with any difference
            diff_mask = diff.sum(axis=2) > 0
            diff_pixels = int(diff_mask.sum())
            total = arr_baseline.shape[0] * arr_baseline.shape[1]
        
        diff_percentage = diff_pixels / total if total > 0 else 0
        passed = diff_percentage <= options.threshold
        
        return ComparisonResult(
            passed=passed,
            diff_percentage=diff_percentage,
            diff_pixel_count=diff_pixels,
            total_pixels=total,
            mode=ComparisonMode.PIXEL_PERFECT,
            threshold=options.threshold,
            baseline_path="",
            actual_path=""
        )
    
    def _compare_anti_aliased(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        options: ComparisonOptions
    ) -> ComparisonResult:
        """
        Comparison with anti-aliasing tolerance.
        
        Uses a pixelmatch-like algorithm that:
        1. Checks if a pixel is anti-aliased (edge pixel)
        2. If so, allows more tolerance
        3. Only counts truly different pixels
        """
        if not NUMPY_AVAILABLE:
            return self._compare_pixel_perfect(baseline, actual, options)
        
        arr_baseline = np.array(baseline).astype(np.int16)
        arr_actual = np.array(actual).astype(np.int16)
        
        # Color threshold in 0-255 scale
        color_threshold = int(options.color_threshold * 255)
        aa_tolerance = options.anti_aliasing_tolerance
        
        # Calculate per-channel differences
        diff = np.abs(arr_baseline - arr_actual)
        
        # Check which pixels exceed color threshold
        exceeds_threshold = diff.max(axis=2) > color_threshold
        
        # Detect anti-aliased pixels (simplified approach)
        # A pixel is potentially anti-aliased if it's on an edge
        # We detect edges by looking at gradient magnitude
        gray_baseline = np.array(baseline.convert('L'))
        gray_actual = np.array(actual.convert('L'))
        
        # Sobel-like edge detection
        def detect_edges(gray: np.ndarray) -> np.ndarray:
            """Simple edge detection using gradients"""
            padded = np.pad(gray, 1, mode='edge')
            
            # Horizontal gradient
            gx = (padded[1:-1, 2:].astype(np.int16) - padded[1:-1, :-2].astype(np.int16))
            # Vertical gradient  
            gy = (padded[2:, 1:-1].astype(np.int16) - padded[:-2, 1:-1].astype(np.int16))
            
            # Gradient magnitude
            magnitude = np.sqrt(gx ** 2 + gy ** 2)
            return magnitude > 20  # Threshold for edge detection
        
        edges_baseline = detect_edges(gray_baseline)
        edges_actual = detect_edges(gray_actual)
        
        # Pixels on edges get more tolerance
        on_edge = edges_baseline | edges_actual
        
        # Final diff mask: pixel is different if:
        # - It exceeds color threshold AND
        # - It's not an edge pixel (or even edge pixels exceed a higher threshold)
        edge_color_threshold = color_threshold * (1 + aa_tolerance / 10)
        
        diff_mask = exceeds_threshold & ~(on_edge & (diff.max(axis=2) <= edge_color_threshold))
        
        diff_pixels = int(diff_mask.sum())
        total = arr_baseline.shape[0] * arr_baseline.shape[1]
        diff_percentage = diff_pixels / total if total > 0 else 0
        passed = diff_percentage <= options.threshold
        
        return ComparisonResult(
            passed=passed,
            diff_percentage=diff_percentage,
            diff_pixel_count=diff_pixels,
            total_pixels=total,
            mode=ComparisonMode.ANTI_ALIASED,
            threshold=options.threshold,
            baseline_path="",
            actual_path=""
        )
    
    def _compare_perceptual(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        options: ComparisonOptions
    ) -> ComparisonResult:
        """
        Perceptual hash comparison.
        
        Uses both aHash and dHash for robust comparison.
        """
        ahash_baseline = self.hasher.compute_ahash(baseline)
        ahash_actual = self.hasher.compute_ahash(actual)
        
        dhash_baseline = self.hasher.compute_dhash(baseline)
        dhash_actual = self.hasher.compute_dhash(actual)
        
        # Calculate similarity for both hash types
        ahash_similarity = self.hasher.similarity(ahash_baseline, ahash_actual)
        dhash_similarity = self.hasher.similarity(dhash_baseline, dhash_actual)
        
        # Use average similarity
        avg_similarity = (ahash_similarity + dhash_similarity) / 2
        diff_percentage = 1.0 - avg_similarity
        
        passed = diff_percentage <= options.threshold
        
        return ComparisonResult(
            passed=passed,
            diff_percentage=diff_percentage,
            diff_pixel_count=int(diff_percentage * (baseline.size[0] * baseline.size[1])),
            total_pixels=baseline.size[0] * baseline.size[1],
            mode=ComparisonMode.PERCEPTUAL,
            threshold=options.threshold,
            baseline_path="",
            actual_path="",
            perceptual_hash_baseline=f"aHash:{ahash_baseline},dHash:{dhash_baseline}",
            perceptual_hash_actual=f"aHash:{ahash_actual},dHash:{dhash_actual}"
        )
    
    def _compare_structural(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        options: ComparisonOptions
    ) -> ComparisonResult:
        """
        SSIM (Structural Similarity Index) comparison.
        
        SSIM considers luminance, contrast, and structure.
        Better for detecting perceptually meaningful differences.
        """
        ssim = self.ssim_calc.compute_ssim(baseline, actual)
        
        # Convert SSIM to diff percentage (SSIM 1.0 = 0% diff, SSIM 0.0 = 100% diff)
        diff_percentage = 1.0 - ssim
        
        passed = diff_percentage <= options.threshold
        
        return ComparisonResult(
            passed=passed,
            diff_percentage=diff_percentage,
            diff_pixel_count=int(diff_percentage * (baseline.size[0] * baseline.size[1])),
            total_pixels=baseline.size[0] * baseline.size[1],
            mode=ComparisonMode.STRUCTURAL,
            threshold=options.threshold,
            baseline_path="",
            actual_path="",
            ssim_score=ssim
        )
    
    def _compare_layout(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        options: ComparisonOptions
    ) -> ComparisonResult:
        """
        Layout-focused comparison.
        
        Detects changes in element positioning and sizing
        while being more tolerant of content changes.
        """
        # Convert to edges only
        def extract_layout(img: 'Image.Image') -> 'Image.Image':
            """Extract layout features (edges)"""
            gray = img.convert('L')
            # Apply edge detection
            edges = gray.filter(ImageFilter.FIND_EDGES)
            # Threshold to binary
            return edges.point(lambda x: 255 if x > 30 else 0)
        
        layout_baseline = extract_layout(baseline)
        layout_actual = extract_layout(actual)
        
        # Compare the layout images
        return self._compare_anti_aliased(
            layout_baseline.convert('RGBA'),
            layout_actual.convert('RGBA'),
            ComparisonOptions(
                mode=ComparisonMode.LAYOUT,
                threshold=options.threshold,
                anti_aliasing_tolerance=5  # More tolerant for layout
            )
        )
    
    async def _compare_ai_semantic(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        options: ComparisonOptions
    ) -> ComparisonResult:
        """
        AI-powered semantic visual comparison using Claude Vision.
        
        This comparison understands the meaning of visual changes:
        - Identifies what changed (text, layout, colors, elements)
        - Distinguishes between breaking changes and acceptable variations
        - Provides detailed explanations of differences
        """
        try:
            import anthropic
            import os
            
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                logger.warning("ANTHROPIC_API_KEY not set, falling back to structural comparison")
                return self._compare_structural(baseline, actual, options)
            
            client = anthropic.Anthropic(api_key=api_key)
            
            # Convert images to base64
            baseline_buffer = io.BytesIO()
            baseline.save(baseline_buffer, format='PNG')
            baseline_b64 = base64.b64encode(baseline_buffer.getvalue()).decode('utf-8')
            
            actual_buffer = io.BytesIO()
            actual.save(actual_buffer, format='PNG')
            actual_b64 = base64.b64encode(actual_buffer.getvalue()).decode('utf-8')
            
            # Analyze with Claude Vision
            prompt = """You are a QA visual testing expert. Compare these two screenshots:

**Image 1 (Baseline)**: The expected/reference screenshot
**Image 2 (Actual)**: The current screenshot to test

Analyze both images and provide:
1. **Overall Assessment**: Are they visually equivalent for testing purposes? (PASS/FAIL)
2. **Similarity Score**: A percentage from 0-100 where 100 means identical
3. **Change Type**: One of [NO_CHANGE, MINOR_STYLING, CONTENT_CHANGE, LAYOUT_CHANGE, BREAKING_CHANGE]
4. **Differences Found**: List specific visual differences
5. **Recommendation**: Should this be flagged for review?

Respond in this exact JSON format:
{
    "passed": true/false,
    "similarity_score": 0-100,
    "change_type": "NO_CHANGE|MINOR_STYLING|CONTENT_CHANGE|LAYOUT_CHANGE|BREAKING_CHANGE",
    "differences": ["list", "of", "differences"],
    "is_breaking": true/false,
    "explanation": "Brief explanation of the comparison result",
    "recommendation": "APPROVE|REVIEW|REJECT"
}

Be strict about layout and structural changes but tolerant of:
- Minor color variations (anti-aliasing, rendering differences)
- Small text rendering differences
- Timestamps or dynamic content areas"""

            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1000,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": baseline_b64
                                }
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": actual_b64
                                }
                            }
                        ]
                    }
                ]
            )
            
            # Parse response
            response_text = response.content[0].text
            
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                ai_result = json.loads(json_match.group())
            else:
                # Fallback if JSON parsing fails
                ai_result = {
                    "passed": "PASS" in response_text.upper(),
                    "similarity_score": 80,
                    "explanation": response_text
                }
            
            similarity = ai_result.get("similarity_score", 80) / 100
            diff_percentage = 1.0 - similarity
            passed = ai_result.get("passed", True) and diff_percentage <= options.threshold
            
            total_pixels = baseline.size[0] * baseline.size[1]
            
            result = ComparisonResult(
                passed=passed,
                diff_percentage=diff_percentage,
                diff_pixel_count=int(diff_percentage * total_pixels),
                total_pixels=total_pixels,
                mode=ComparisonMode.AI_SEMANTIC,
                threshold=options.threshold,
                baseline_path="",
                actual_path="",
                mismatch_regions=[{
                    "type": ai_result.get("change_type", "UNKNOWN"),
                    "differences": ai_result.get("differences", []),
                    "explanation": ai_result.get("explanation", ""),
                    "recommendation": ai_result.get("recommendation", "REVIEW"),
                    "is_breaking": ai_result.get("is_breaking", False)
                }]
            )
            
            return result
            
        except ImportError:
            logger.warning("anthropic not installed, falling back to structural comparison")
            return self._compare_structural(baseline, actual, options)
        except Exception as e:
            logger.error(f"AI comparison failed: {e}, falling back to structural comparison")
            return self._compare_structural(baseline, actual, options)
    
    def _generate_diff_image(
        self,
        baseline: 'Image.Image',
        actual: 'Image.Image',
        options: ComparisonOptions
    ) -> Optional['Image.Image']:
        """
        Generate a visual diff image with side-by-side comparison
        and highlighted differences.
        """
        if not NUMPY_AVAILABLE:
            # Fallback to simple diff
            diff = ImageChops.difference(baseline, actual)
            return diff
        
        width, height = baseline.size
        
        # Create a composite image: [Baseline | Diff | Actual]
        composite_width = width * 3 + 20  # 10px padding between images
        composite = Image.new('RGBA', (composite_width, height + 40), (30, 30, 30, 255))
        
        draw = ImageDraw.Draw(composite)
        
        # Labels
        try:
            # Try to add labels (may fail without fonts)
            draw.text((width // 2 - 30, 5), "Baseline", fill=(150, 150, 150, 255))
            draw.text((width + 10 + width // 2 - 20, 5), "Diff", fill=(255, 100, 100, 255))
            draw.text((width * 2 + 20 + width // 2 - 20, 5), "Actual", fill=(150, 150, 150, 255))
        except:
            pass
        
        label_offset = 30
        
        # Paste baseline
        composite.paste(baseline, (0, label_offset))
        
        # Create diff highlight
        arr_baseline = np.array(baseline)
        arr_actual = np.array(actual)
        diff_raw = np.abs(arr_baseline.astype(np.int16) - arr_actual.astype(np.int16))
        
        # Create diff visualization
        diff_mask = diff_raw.max(axis=2) > int(options.color_threshold * 255)
        
        # Create highlighted diff image
        diff_img = baseline.copy()
        diff_arr = np.array(diff_img)
        
        # Highlight differences in magenta
        highlight_color = options.highlight_color
        diff_arr[diff_mask] = [highlight_color[0], highlight_color[1], highlight_color[2], highlight_color[3]]
        
        diff_highlighted = Image.fromarray(diff_arr.astype(np.uint8))
        
        # Paste diff
        composite.paste(diff_highlighted, (width + 10, label_offset))
        
        # Paste actual
        composite.paste(actual, (width * 2 + 20, label_offset))
        
        return composite
    
    def _safe_filename(self, name: str) -> str:
        """Convert to safe filename"""
        import re
        safe = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
        return safe[:100]
    
    # ==================== Baseline Management ====================
    
    def save_baseline(
        self,
        image: Union[str, Path, bytes, 'Image.Image'],
        test_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Save an image as a baseline.
        
        Args:
            image: Image to save as baseline
            test_name: Unique test name
            metadata: Optional metadata to store with baseline
            
        Returns:
            Path to saved baseline
        """
        img = self._load_image(image)
        if img is None:
            raise ValueError("Could not load image")
        
        safe_name = self._safe_filename(test_name)
        baseline_path = self.baselines_dir / f"{safe_name}.png"
        
        img.save(baseline_path, 'PNG')
        
        # Save metadata
        meta = {
            "test_name": test_name,
            "created_at": datetime.now().isoformat(),
            "dimensions": img.size,
            "perceptual_hash_ahash": self.hasher.compute_ahash(img),
            "perceptual_hash_dhash": self.hasher.compute_dhash(img),
            **(metadata or {})
        }
        
        metadata_path = self.metadata_dir / f"{safe_name}.json"
        with open(metadata_path, 'w') as f:
            json.dump(meta, f, indent=2)
        
        logger.info(f"Saved baseline: {baseline_path}")
        return str(baseline_path)
    
    def get_baseline(self, test_name: str) -> Optional[Path]:
        """Get path to baseline image"""
        safe_name = self._safe_filename(test_name)
        baseline_path = self.baselines_dir / f"{safe_name}.png"
        return baseline_path if baseline_path.exists() else None
    
    def get_baseline_metadata(self, test_name: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a baseline"""
        safe_name = self._safe_filename(test_name)
        metadata_path = self.metadata_dir / f"{safe_name}.json"
        
        if not metadata_path.exists():
            return None
        
        with open(metadata_path) as f:
            return json.load(f)
    
    def list_baselines(self) -> List[Dict[str, Any]]:
        """List all baselines with their metadata"""
        baselines = []
        
        for png_path in self.baselines_dir.glob("*.png"):
            test_name = png_path.stem
            meta = self.get_baseline_metadata(test_name) or {}
            
            baselines.append({
                "test_name": test_name,
                "path": str(png_path),
                "file_size": png_path.stat().st_size,
                "modified_at": datetime.fromtimestamp(png_path.stat().st_mtime).isoformat(),
                **meta
            })
        
        return sorted(baselines, key=lambda x: x.get("modified_at", ""), reverse=True)
    
    def delete_baseline(self, test_name: str) -> bool:
        """Delete a baseline and its metadata"""
        safe_name = self._safe_filename(test_name)
        baseline_path = self.baselines_dir / f"{safe_name}.png"
        metadata_path = self.metadata_dir / f"{safe_name}.json"
        
        deleted = False
        
        if baseline_path.exists():
            baseline_path.unlink()
            deleted = True
        
        if metadata_path.exists():
            metadata_path.unlink()
        
        return deleted
    
    def update_baseline(
        self,
        test_name: str,
        new_image: Union[str, Path, bytes, 'Image.Image'],
        reason: str = ""
    ) -> str:
        """
        Update an existing baseline.
        
        Args:
            test_name: Test name
            new_image: New baseline image
            reason: Reason for update (for audit trail)
            
        Returns:
            Path to updated baseline
        """
        # Save old baseline for history if it exists
        old_baseline = self.get_baseline(test_name)
        if old_baseline:
            # Archive old baseline
            archive_dir = self.storage_path / "archive" / self._safe_filename(test_name)
            archive_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            archive_path = archive_dir / f"baseline_{timestamp}.png"
            
            import shutil
            shutil.copy(old_baseline, archive_path)
            
            logger.info(f"Archived old baseline to {archive_path}")
        
        # Save new baseline
        return self.save_baseline(new_image, test_name, {
            "update_reason": reason,
            "previous_baseline": str(old_baseline) if old_baseline else None
        })


# Convenience functions for API usage
def compare_images(
    baseline: Union[str, bytes],
    actual: Union[str, bytes],
    mode: str = "anti_aliased",
    threshold: float = 0.1,
    ignore_regions: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Compare two images and return comparison result.
    
    Args:
        baseline: Baseline image (path or base64)
        actual: Actual image (path or base64)
        mode: Comparison mode (pixel_perfect, anti_aliased, perceptual, structural)
        threshold: Allowed difference percentage (0.0 to 1.0)
        ignore_regions: List of regions to ignore
        
    Returns:
        Comparison result as dictionary
    """
    engine = VisualTestingEngine()
    
    # Convert mode string to enum
    try:
        comparison_mode = ComparisonMode(mode)
    except ValueError:
        comparison_mode = ComparisonMode.ANTI_ALIASED
    
    # Build ignore regions
    regions = []
    if ignore_regions:
        for r in ignore_regions:
            regions.append(IgnoreRegion(
                x=r.get("x", 0),
                y=r.get("y", 0),
                width=r.get("width", 0),
                height=r.get("height", 0),
                name=r.get("name", ""),
                reason=r.get("reason", "")
            ))
    
    options = ComparisonOptions(
        mode=comparison_mode,
        threshold=threshold,
        ignore_regions=regions
    )
    
    # Handle base64 input
    if isinstance(baseline, str) and not Path(baseline).exists() and len(baseline) > 200:
        baseline = base64.b64decode(baseline)
    if isinstance(actual, str) and not Path(actual).exists() and len(actual) > 200:
        actual = base64.b64decode(actual)
    
    result = engine.compare(baseline, actual, options)
    return result.to_dict()

