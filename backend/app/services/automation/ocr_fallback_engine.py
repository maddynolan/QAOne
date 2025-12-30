"""
OCR Fallback Engine - Last Resort When All Locators Fail
Uses screenshot OCR to find text and click by coordinates

This is the NUCLEAR OPTION when:
1. All DOM selectors fail
2. Element is in Shadow DOM that can't be pierced
3. Canvas/SVG elements without accessible text
4. Heavily obfuscated elements
"""

import logging
import io
import base64
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from PIL import Image
import os

logger = logging.getLogger(__name__)

# Try to import OCR libraries
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
    
    # Set Tesseract path for Windows
    if os.name == 'nt':
        tesseract_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        ]
        for path in tesseract_paths:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                break
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not available for OCR fallback")


@dataclass
class OCRMatch:
    """Represents a text match found via OCR"""
    text: str
    confidence: float
    bounding_box: Tuple[int, int, int, int]  # x, y, width, height
    center_x: int
    center_y: int


class OCRFallbackEngine:
    """
    OCR-based fallback for when all DOM locators fail.
    
    HOW IT WORKS:
    1. Take screenshot of the page
    2. Use Tesseract OCR to find the target text
    3. Get the bounding box coordinates
    4. Click at those exact coordinates using Playwright mouse.click(x, y)
    
    This is a LAST RESORT - slower than DOM locators but works when nothing else does.
    
    Example:
        engine = OCRFallbackEngine()
        
        # Find "Login" button using OCR
        match = engine.find_text_in_screenshot(screenshot_base64, "Login")
        
        if match:
            # Click at the center of the matched text
            await page.mouse.click(match.center_x, match.center_y)
    """
    
    def __init__(self, similarity_threshold: float = 0.7):
        """
        Initialize OCR fallback engine.
        
        Args:
            similarity_threshold: Minimum text similarity (0-1) for fuzzy matching
        """
        self.similarity_threshold = similarity_threshold
        self.ocr_available = TESSERACT_AVAILABLE
        
        if not self.ocr_available:
            logger.warning("OCR fallback engine initialized but Tesseract not available")
    
    def is_available(self) -> bool:
        """Check if OCR fallback is available"""
        return self.ocr_available
    
    def find_text_in_screenshot(
        self,
        screenshot_base64: str,
        target_text: str,
        exact_match: bool = False
    ) -> Optional[OCRMatch]:
        """
        Find text in screenshot using OCR.
        
        Args:
            screenshot_base64: Base64-encoded screenshot
            target_text: Text to find
            exact_match: If True, requires exact match. If False, allows fuzzy matching.
            
        Returns:
            OCRMatch with coordinates if found, None otherwise
        """
        if not self.ocr_available:
            logger.error("Tesseract not available for OCR fallback")
            return None
        
        try:
            # Decode screenshot
            image_data = base64.b64decode(
                screenshot_base64.split(',')[-1] if ',' in screenshot_base64 else screenshot_base64
            )
            image = Image.open(io.BytesIO(image_data))
            
            # Get OCR data with bounding boxes
            ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            # Search for target text
            matches = self._find_matches(ocr_data, target_text, exact_match)
            
            if matches:
                # Return best match (highest confidence)
                best_match = max(matches, key=lambda m: m.confidence)
                logger.info(
                    f"[OCR FALLBACK] Found '{target_text}' at coordinates "
                    f"({best_match.center_x}, {best_match.center_y}) "
                    f"with confidence {best_match.confidence:.2f}"
                )
                return best_match
            else:
                logger.warning(f"[OCR FALLBACK] Text '{target_text}' not found in screenshot")
                return None
                
        except Exception as e:
            logger.error(f"[OCR FALLBACK] Error finding text: {e}", exc_info=True)
            return None
    
    def find_all_text_in_screenshot(
        self,
        screenshot_base64: str,
        target_text: str
    ) -> List[OCRMatch]:
        """
        Find all occurrences of text in screenshot.
        Useful when there are multiple buttons/links with same text.
        """
        if not self.ocr_available:
            return []
        
        try:
            image_data = base64.b64decode(
                screenshot_base64.split(',')[-1] if ',' in screenshot_base64 else screenshot_base64
            )
            image = Image.open(io.BytesIO(image_data))
            
            ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            return self._find_matches(ocr_data, target_text, exact_match=False)
            
        except Exception as e:
            logger.error(f"[OCR FALLBACK] Error: {e}")
            return []
    
    def _find_matches(
        self,
        ocr_data: Dict[str, List],
        target_text: str,
        exact_match: bool
    ) -> List[OCRMatch]:
        """Find all matches of target text in OCR data"""
        matches = []
        target_lower = target_text.lower().strip()
        
        n_boxes = len(ocr_data['text'])
        
        # First try single-word matches
        for i in range(n_boxes):
            text = ocr_data['text'][i].strip()
            if not text:
                continue
            
            confidence = int(ocr_data['conf'][i]) if ocr_data['conf'][i] != '-1' else 0
            
            # Check for match
            if exact_match:
                is_match = text.lower() == target_lower
            else:
                is_match = (
                    target_lower in text.lower() or 
                    text.lower() in target_lower or
                    self._fuzzy_match(text.lower(), target_lower)
                )
            
            if is_match and confidence > 30:  # Minimum confidence threshold
                x = ocr_data['left'][i]
                y = ocr_data['top'][i]
                w = ocr_data['width'][i]
                h = ocr_data['height'][i]
                
                matches.append(OCRMatch(
                    text=text,
                    confidence=confidence / 100.0,
                    bounding_box=(x, y, w, h),
                    center_x=x + w // 2,
                    center_y=y + h // 2
                ))
        
        # If no single-word matches, try multi-word matching
        if not matches and ' ' in target_text:
            matches = self._find_multi_word_matches(ocr_data, target_text)
        
        return matches
    
    def _find_multi_word_matches(
        self,
        ocr_data: Dict[str, List],
        target_text: str
    ) -> List[OCRMatch]:
        """
        Find multi-word text by looking for consecutive words.
        E.g., "Add to Cart" might be detected as separate words.
        """
        matches = []
        target_words = target_text.lower().split()
        n_boxes = len(ocr_data['text'])
        
        i = 0
        while i < n_boxes:
            # Check if this starts a match
            text_i = ocr_data['text'][i].strip().lower()
            
            if text_i and text_i == target_words[0]:
                # Found first word, check consecutive words
                matched_indices = [i]
                word_idx = 1
                
                j = i + 1
                while j < n_boxes and word_idx < len(target_words):
                    text_j = ocr_data['text'][j].strip().lower()
                    
                    if text_j == target_words[word_idx]:
                        matched_indices.append(j)
                        word_idx += 1
                    elif text_j:
                        # Non-empty but doesn't match - break
                        break
                    j += 1
                
                # Check if we matched all words
                if word_idx == len(target_words):
                    # Calculate combined bounding box
                    x_min = min(ocr_data['left'][idx] for idx in matched_indices)
                    y_min = min(ocr_data['top'][idx] for idx in matched_indices)
                    x_max = max(
                        ocr_data['left'][idx] + ocr_data['width'][idx] 
                        for idx in matched_indices
                    )
                    y_max = max(
                        ocr_data['top'][idx] + ocr_data['height'][idx] 
                        for idx in matched_indices
                    )
                    
                    w = x_max - x_min
                    h = y_max - y_min
                    
                    avg_confidence = sum(
                        int(ocr_data['conf'][idx]) if ocr_data['conf'][idx] != '-1' else 0
                        for idx in matched_indices
                    ) / len(matched_indices)
                    
                    matches.append(OCRMatch(
                        text=target_text,
                        confidence=avg_confidence / 100.0,
                        bounding_box=(x_min, y_min, w, h),
                        center_x=x_min + w // 2,
                        center_y=y_min + h // 2
                    ))
            
            i += 1
        
        return matches
    
    def _fuzzy_match(self, text1: str, text2: str) -> bool:
        """Simple fuzzy string matching"""
        if not text1 or not text2:
            return False
        
        # Check if one contains the other
        if text1 in text2 or text2 in text1:
            return True
        
        # Calculate Levenshtein-like similarity
        similarity = self._calculate_similarity(text1, text2)
        return similarity >= self.similarity_threshold
    
    def _calculate_similarity(self, s1: str, s2: str) -> float:
        """Calculate string similarity (0-1)"""
        if s1 == s2:
            return 1.0
        
        # Simple Jaccard-like similarity on characters
        set1 = set(s1)
        set2 = set(s2)
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        return intersection / union if union > 0 else 0.0
    
    def generate_ocr_fallback_code(
        self,
        target_text: str,
        action: str = "click"
    ) -> str:
        """
        Generate Playwright code that uses OCR fallback.
        
        This code:
        1. Takes a screenshot
        2. Sends it to OCR API
        3. Gets coordinates
        4. Clicks at those coordinates
        
        Args:
            target_text: Text to find and click
            action: Action to perform (click, dblclick)
            
        Returns:
            Playwright code string
        """
        escaped_text = target_text.replace("'", "\\'").replace('"', '\\"')
        
        return f'''
// OCR FALLBACK - Last resort when all locators fail
async function ocrFallback{action.capitalize()}(page, targetText) {{
  console.log('[OCR FALLBACK] All locators failed, using OCR to find: ' + targetText);
  
  // Take screenshot
  const screenshot = await page.screenshot({{ type: 'png' }});
  const screenshotBase64 = screenshot.toString('base64');
  
  // Call OCR API to find text coordinates
  const response = await fetch('http://localhost:8000/api/ocr/find-text', {{
    method: 'POST',
    headers: {{ 'Content-Type': 'application/json' }},
    body: JSON.stringify({{
      screenshot: screenshotBase64,
      target_text: targetText
    }})
  }});
  
  const result = await response.json();
  
  if (result.found && result.center_x && result.center_y) {{
    console.log(`[OCR FALLBACK] Found at (${{result.center_x}}, ${{result.center_y}})`);
    
    // Click at the coordinates
    await page.mouse.{action}(result.center_x, result.center_y);
    
    return {{
      success: true,
      strategy: 'ocr_fallback',
      coordinates: {{ x: result.center_x, y: result.center_y }},
      confidence: result.confidence
    }};
  }} else {{
    throw new Error(`[OCR FALLBACK] Could not find text: "${{targetText}}" in screenshot`);
  }}
}}

// Usage: await ocrFallbackClick(page, '{escaped_text}');
'''

    def generate_complete_fallback_chain(
        self,
        primary_locator: str,
        fallback_locators: List[str],
        target_text: str,
        action: str = "click"
    ) -> str:
        """
        Generate complete fallback chain with OCR as last resort.
        
        Chain order:
        1. Primary locator
        2. Fallback locators
        3. Force click on primary
        4. OCR-based coordinate click (LAST RESORT)
        """
        escaped_text = target_text.replace("'", "\\'")
        
        code = f'''
// Complete fallback chain with OCR last resort
async function {action}WithFullFallback(page) {{
  const targetText = '{escaped_text}';
  
  // Strategy 1: Primary locator
  try {{
    const element = {primary_locator};
    await element.waitFor({{ state: 'visible', timeout: 5000 }});
    await element.{action}({{ timeout: 5000 }});
    console.log('[SUCCESS] Primary locator worked');
    return {{ success: true, strategy: 'primary' }};
  }} catch (e) {{
    console.log('[FALLBACK] Primary failed:', e.message);
  }}
  
'''
        # Add fallback locators
        for i, fallback in enumerate(fallback_locators[:5]):
            code += f'''
  // Strategy {i + 2}: Fallback {i + 1}
  try {{
    const element = {fallback};
    await element.waitFor({{ state: 'visible', timeout: 3000 }});
    await element.{action}({{ timeout: 3000 }});
    console.log('[SUCCESS] Fallback {i + 1} worked');
    return {{ success: true, strategy: 'fallback_{i + 1}' }};
  }} catch (e) {{
    console.log('[FALLBACK] Fallback {i + 1} failed:', e.message);
  }}
'''
        
        # Force click
        code += f'''
  // Strategy: Force click (ignores visibility/actionability)
  try {{
    const element = {primary_locator};
    await element.waitFor({{ state: 'attached', timeout: 3000 }});
    await element.{action}({{ force: true, timeout: 3000 }});
    console.log('[SUCCESS] Force click worked');
    return {{ success: true, strategy: 'force_click' }};
  }} catch (e) {{
    console.log('[FALLBACK] Force click failed:', e.message);
  }}
  
  // Strategy: JavaScript click (bypasses Playwright checks)
  try {{
    const element = {primary_locator};
    await element.evaluate(el => el.click());
    console.log('[SUCCESS] JavaScript click worked');
    return {{ success: true, strategy: 'js_click' }};
  }} catch (e) {{
    console.log('[FALLBACK] JS click failed:', e.message);
  }}
  
  // LAST RESORT: OCR-based coordinate click
  console.log('[OCR FALLBACK] All DOM-based strategies failed, using OCR...');
  
  try {{
    const screenshot = await page.screenshot({{ type: 'png' }});
    const screenshotBase64 = screenshot.toString('base64');
    
    const response = await fetch('http://localhost:8000/api/ocr/find-text', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{
        screenshot: screenshotBase64,
        target_text: targetText
      }})
    }});
    
    const result = await response.json();
    
    if (result.found && result.center_x && result.center_y) {{
      console.log(`[OCR SUCCESS] Found at (${{result.center_x}}, ${{result.center_y}})`);
      await page.mouse.{action}(result.center_x, result.center_y);
      return {{
        success: true,
        strategy: 'ocr_coordinate_click',
        coordinates: {{ x: result.center_x, y: result.center_y }},
        confidence: result.confidence
      }};
    }}
  }} catch (e) {{
    console.log('[OCR FALLBACK] OCR failed:', e.message);
  }}
  
  // Everything failed
  throw new Error(`All strategies failed to {action} element with text: "${{targetText}}"`);
}}
'''
        return code


# Singleton instance
_ocr_fallback_engine: Optional[OCRFallbackEngine] = None


def get_ocr_fallback_engine() -> OCRFallbackEngine:
    """Get or create the OCR fallback engine singleton"""
    global _ocr_fallback_engine
    if _ocr_fallback_engine is None:
        _ocr_fallback_engine = OCRFallbackEngine()
    return _ocr_fallback_engine



