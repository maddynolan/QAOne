"""
Screenshot Analyzer - OCR and Visual Analysis
Extracts text and visual information from screenshots to improve test case quality
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
import base64
import io
import os
from PIL import Image
import re

logger = logging.getLogger(__name__)

# Try to import OCR libraries (optional dependencies)
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
    
    # Set Tesseract path for Windows (common installation location)
    # This handles cases where Tesseract is installed but not in PATH
    if os.name == 'nt':  # Windows
        tesseract_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        ]
        for path in tesseract_paths:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                logger.debug(f"Tesseract found at: {path}")
                break
        else:
            # If not found in common locations, try to use from PATH
            logger.debug("Tesseract not found in common locations, using PATH")
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not available - OCR features will be disabled. Install with: pip install pytesseract pillow")

try:
    from google.cloud import vision
    GOOGLE_VISION_AVAILABLE = True
except ImportError:
    GOOGLE_VISION_AVAILABLE = False
    logger.debug("Google Vision API not available - will use Tesseract if available")


class ScreenshotAnalyzer:
    """
    Analyzes screenshots to extract:
    1. Page titles and headings (OCR)
    2. Button text and labels (OCR)
    3. Form field labels (OCR)
    4. Visual state information
    5. Success/error indicators
    """
    
    def __init__(self, ocr_provider: str = "tesseract"):
        """
        Initialize screenshot analyzer.
        
        Args:
            ocr_provider: "tesseract" (free, local) or "google_vision" (better accuracy, requires API key)
        """
        self.ocr_provider = ocr_provider
        self.ocr_available = False
        
        if ocr_provider == "tesseract" and TESSERACT_AVAILABLE:
            self.ocr_available = True
            logger.debug("ScreenshotAnalyzer initialized with Tesseract OCR")
        elif ocr_provider == "google_vision" and GOOGLE_VISION_AVAILABLE:
            self.ocr_available = True
            self.vision_client = vision.ImageAnnotatorClient()
            logger.debug("ScreenshotAnalyzer initialized with Google Vision API")
        else:
            logger.warning(f"ScreenshotAnalyzer initialized without OCR (provider: {ocr_provider})")
    
    def extract_text_from_screenshot(
        self,
        screenshot_base64: str,
        region: Optional[Tuple[int, int, int, int]] = None
    ) -> Dict[str, Any]:
        """
        Extract text from screenshot using OCR.
        
        Args:
            screenshot_base64: Base64-encoded screenshot image
            region: Optional (x, y, width, height) region to extract from
        
        Returns:
            Dict with extracted text and metadata
        """
        if not self.ocr_available:
            return {
                "text": "",
                "confidence": 0.0,
                "provider": self.ocr_provider,
                "available": False,
                "error": "OCR not available"
            }
        
        try:
            # Decode base64 image
            image_data = base64.b64decode(screenshot_base64.split(',')[-1] if ',' in screenshot_base64 else screenshot_base64)
            image = Image.open(io.BytesIO(image_data))
            
            # Crop to region if specified
            if region:
                x, y, width, height = region
                image = image.crop((x, y, x + width, y + height))
            
            if self.ocr_provider == "tesseract":
                return self._extract_with_tesseract(image)
            elif self.ocr_provider == "google_vision":
                return self._extract_with_google_vision(image_data)
            else:
                return {"text": "", "confidence": 0.0, "error": "Unknown OCR provider"}
        
        except Exception as e:
            logger.error(f"Error extracting text from screenshot: {e}", exc_info=True)
            return {
                "text": "",
                "confidence": 0.0,
                "error": str(e)
            }
    
    def _extract_with_tesseract(self, image: Image.Image) -> Dict[str, Any]:
        """Extract text using Tesseract OCR"""
        try:
            # Extract text
            text = pytesseract.image_to_string(image)
            
            # Get confidence scores (if available)
            try:
                data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
                confidences = [int(conf) for conf in data['conf'] if conf != '-1']
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            except:
                avg_confidence = 0.0
            
            return {
                "text": text.strip(),
                "confidence": avg_confidence / 100.0,  # Normalize to 0-1
                "provider": "tesseract",
                "available": True
            }
        except Exception as e:
            logger.error(f"Tesseract OCR error: {e}", exc_info=True)
            return {
                "text": "",
                "confidence": 0.0,
                "error": str(e)
            }
    
    def _extract_with_google_vision(self, image_data: bytes) -> Dict[str, Any]:
        """Extract text using Google Vision API"""
        try:
            image = vision.Image(content=image_data)
            response = self.vision_client.text_detection(image=image)
            
            if response.error.message:
                return {
                    "text": "",
                    "confidence": 0.0,
                    "error": response.error.message
                }
            
            texts = response.text_annotations
            if texts:
                # First text is usually the full detected text
                full_text = texts[0].description
                # Calculate average confidence from all detections
                confidences = [annotation.confidence for annotation in texts[1:] if hasattr(annotation, 'confidence')]
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0.9
                
                return {
                    "text": full_text.strip(),
                    "confidence": avg_confidence,
                    "provider": "google_vision",
                    "available": True
                }
            else:
                return {
                    "text": "",
                    "confidence": 0.0,
                    "error": "No text detected"
                }
        except Exception as e:
            logger.error(f"Google Vision API error: {e}", exc_info=True)
            return {
                "text": "",
                "confidence": 0.0,
                "error": str(e)
            }
    
    def extract_page_title(self, ocr_result: Dict[str, Any]) -> Optional[str]:
        """
        Extract page title from OCR text.
        Looks for:
        - Text in top 20% of page
        - Large text (headings)
        - Common title patterns
        """
        text = ocr_result.get("text", "")
        if not text:
            return None
        
        lines = text.split('\n')
        # First few lines are usually page title/heading
        for line in lines[:5]:
            line = line.strip()
            if line and len(line) > 3 and len(line) < 100:
                # Filter out common non-title text
                if not any(word in line.lower() for word in ["skip", "menu", "navigation", "cookie", "accept"]):
                    return line
        
        return None
    
    def extract_button_text(
        self,
        ocr_result: Dict[str, Any],
        element_selector: Optional[str] = None,
        bounding_box: Optional[Tuple[int, int, int, int]] = None
    ) -> Optional[str]:
        """
        Extract button text from OCR result.
        Can use element selector or bounding box to locate button in screenshot.
        """
        text = ocr_result.get("text", "")
        if not text:
            return None
        
        # If we have bounding box, extract text from that region
        if bounding_box:
            # This would require region-specific OCR - simplified for now
            pass
        
        # Look for button-like text (short, action words)
        lines = text.split('\n')
        button_keywords = ["login", "submit", "sign in", "sign up", "add to cart", "checkout", "continue", "next", "save", "cancel"]
        
        for line in lines:
            line = line.strip()
            line_lower = line.lower()
            # Check if line contains button keywords or is short (likely a button)
            if any(keyword in line_lower for keyword in button_keywords) or (len(line) < 30 and len(line) > 2):
                return line
        
        return None
    
    def extract_form_labels(
        self,
        ocr_result: Dict[str, Any],
        field_name: Optional[str] = None
    ) -> Optional[str]:
        """
        Extract form field label from OCR result.
        Looks for text near input fields.
        """
        text = ocr_result.get("text", "")
        if not text:
            return None
        
        if field_name:
            # Look for field name in OCR text
            field_lower = field_name.lower()
            lines = text.split('\n')
            for i, line in enumerate(lines):
                line_lower = line.lower()
                # Check if line contains field name or is adjacent to it
                if field_lower in line_lower or (i > 0 and field_lower in lines[i-1].lower()):
                    # Extract label (usually the line before or containing the field)
                    label = line.strip()
                    if label and len(label) < 50:
                        return label
        
        return None
    
    def detect_visual_changes(
        self,
        before_screenshot: str,
        after_screenshot: str
    ) -> Dict[str, Any]:
        """
        Detect visual changes between two screenshots.
        Returns information about what changed (navigation, new content, errors, etc.)
        """
        # This is a placeholder - would need image comparison library
        # Could use opencv for image diff, or simple pixel comparison
        
        return {
            "changed": True,
            "change_type": "unknown",  # navigation, content_update, error, success
            "confidence": 0.0
        }
    
    def identify_page_type(self, ocr_result: Dict[str, Any]) -> Optional[str]:
        """
        Identify page type from visual content (login, product listing, cart, checkout, etc.)
        """
        text = ocr_result.get("text", "").lower()
        
        # Pattern matching for common page types
        if any(word in text for word in ["username", "password", "sign in", "login"]):
            return "login"
        elif any(word in text for word in ["add to cart", "shopping cart", "cart"]):
            return "cart"
        elif any(word in text for word in ["checkout", "payment", "billing"]):
            return "checkout"
        elif any(word in text for word in ["product", "items", "results"]):
            return "product_listing"
        elif any(word in text for word in ["search", "find"]):
            return "search"
        else:
            return None

