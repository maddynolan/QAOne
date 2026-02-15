"""
OCR Fallback API - Last Resort Element Finding

When all DOM-based locators fail, this API finds elements by:
1. Taking a screenshot
2. Running OCR to find target text
3. Returning coordinates for clicking

This is the NUCLEAR OPTION - slower but works when nothing else does.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.services.automation.ocr_fallback_engine import (
    get_ocr_fallback_engine,
    OCRMatch
)

router = APIRouter(prefix="/api/ocr", tags=["OCR Fallback"])


class FindTextRequest(BaseModel):
    """Request to find text in screenshot"""
    screenshot: str  # Base64-encoded screenshot
    target_text: str
    exact_match: bool = False


class FindTextResponse(BaseModel):
    """Response with text location"""
    found: bool
    text: Optional[str] = None
    confidence: Optional[float] = None
    center_x: Optional[int] = None
    center_y: Optional[int] = None
    bounding_box: Optional[Dict[str, int]] = None
    strategy: str = "ocr_tesseract"


class FindAllTextResponse(BaseModel):
    """Response with all text matches"""
    found: bool
    count: int
    matches: List[Dict[str, Any]]


@router.post("/find-text", response_model=FindTextResponse)
async def find_text_in_screenshot(request: FindTextRequest):
    """
    Find text in screenshot using OCR.
    
    This is the LAST RESORT when all DOM locators fail.
    
    Process:
    1. Receives screenshot (base64)
    2. Runs Tesseract OCR
    3. Finds target text
    4. Returns center coordinates for clicking
    
    Usage in generated tests:
    ```javascript
    // When all locators fail:
    const screenshot = await page.screenshot({ type: 'png' });
    const response = await fetch('/api/ocr/find-text', {
        method: 'POST',
        body: JSON.stringify({
            screenshot: screenshot.toString('base64'),
            target_text: 'Login'
        })
    });
    const { center_x, center_y } = await response.json();
    await page.mouse.click(center_x, center_y);
    ```
    """
    engine = get_ocr_fallback_engine()
    
    if not engine.is_available():
        raise HTTPException(
            status_code=503,
            detail="OCR not available. Install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki"
        )
    
    match = engine.find_text_in_screenshot(
        screenshot_base64=request.screenshot,
        target_text=request.target_text,
        exact_match=request.exact_match
    )
    
    if match:
        return FindTextResponse(
            found=True,
            text=match.text,
            confidence=match.confidence,
            center_x=match.center_x,
            center_y=match.center_y,
            bounding_box={
                "x": match.bounding_box[0],
                "y": match.bounding_box[1],
                "width": match.bounding_box[2],
                "height": match.bounding_box[3]
            }
        )
    else:
        return FindTextResponse(
            found=False,
            text=None,
            confidence=0.0
        )


@router.post("/find-all-text", response_model=FindAllTextResponse)
async def find_all_text_in_screenshot(request: FindTextRequest):
    """
    Find ALL occurrences of text in screenshot.
    
    Useful when there are multiple elements with same text
    (e.g., multiple "Edit" buttons in a list).
    """
    engine = get_ocr_fallback_engine()
    
    if not engine.is_available():
        raise HTTPException(
            status_code=503,
            detail="OCR not available"
        )
    
    matches = engine.find_all_text_in_screenshot(
        screenshot_base64=request.screenshot,
        target_text=request.target_text
    )
    
    return FindAllTextResponse(
        found=len(matches) > 0,
        count=len(matches),
        matches=[
            {
                "text": m.text,
                "confidence": m.confidence,
                "center_x": m.center_x,
                "center_y": m.center_y,
                "bounding_box": {
                    "x": m.bounding_box[0],
                    "y": m.bounding_box[1],
                    "width": m.bounding_box[2],
                    "height": m.bounding_box[3]
                }
            }
            for m in matches
        ]
    )


@router.get("/status")
async def ocr_status():
    """
    Check OCR fallback availability.
    
    Returns status of:
    - Tesseract installation
    - OCR engine health
    """
    engine = get_ocr_fallback_engine()
    
    return {
        "available": engine.is_available(),
        "provider": "tesseract",
        "status": "ready" if engine.is_available() else "unavailable",
        "message": (
            "OCR fallback ready" if engine.is_available()
            else "Install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki"
        ),
        "usage": {
            "when_to_use": "Last resort when all DOM locators fail",
            "how_it_works": [
                "1. Take screenshot of page",
                "2. Send to /api/ocr/find-text",
                "3. Get coordinates of target text",
                "4. Click at those coordinates with page.mouse.click(x, y)"
            ],
            "performance": "Slower than DOM locators (~500ms per OCR call)",
            "accuracy": "Good for clear text, may struggle with styled/distorted text"
        }
    }


@router.get("/generate-fallback-code")
async def generate_fallback_code(
    target_text: str,
    primary_locator: str = "page.getByText('Login')",
    action: str = "click"
):
    """
    Generate Playwright code with OCR fallback chain.
    
    Returns code that:
    1. Tries primary locator
    2. Tries fallback locators
    3. Tries force click
    4. Uses OCR as last resort
    """
    engine = get_ocr_fallback_engine()
    
    code = engine.generate_complete_fallback_chain(
        primary_locator=primary_locator,
        fallback_locators=[
            f"page.getByRole('button', {{ name: '{target_text}' }})",
            f"page.locator('button:has-text(\"{target_text}\")')",
            f"page.locator('[aria-label=\"{target_text}\"]')"
        ],
        target_text=target_text,
        action=action
    )
    
    return {
        "code": code,
        "explanation": {
            "strategy_1": "Primary locator",
            "strategy_2-4": "Fallback locators (role, CSS, aria)",
            "strategy_5": "Force click (ignores visibility)",
            "strategy_6": "JavaScript click (bypasses Playwright)",
            "strategy_7": "OCR coordinate click (LAST RESORT)"
        }
    }


@router.get("/comparison")
async def compare_with_traditional():
    """
    How OCR fallback compares to traditional approaches.
    """
    return {
        "title": "OCR Fallback - When Nothing Else Works",
        "comparison": {
            "dom_locators": {
                "speed": "Fast (~10ms)",
                "reliability": "High when selectors are stable",
                "works_with": "Standard DOM elements",
                "fails_when": "Dynamic IDs, Shadow DOM, Canvas, heavy obfuscation"
            },
            "ocr_fallback": {
                "speed": "Slow (~500ms per call)",
                "reliability": "Medium - depends on text clarity",
                "works_with": "ANY visible text on screen",
                "fails_when": "Distorted text, very small text, text in images"
            },
            "pyautogui": {
                "speed": "Fast once coordinates known",
                "reliability": "Low - screen resolution dependent",
                "works_with": "Anything on screen",
                "fails_when": "Different resolutions, headless mode"
            }
        },
        "our_approach": {
            "uses": "Playwright mouse.click(x, y)",
            "advantages": [
                "Works in headless mode",
                "Resolution independent (uses page coordinates)",
                "More reliable than pyautogui",
                "Integrated with Playwright test flow"
            ],
            "disadvantages": [
                "Slower than DOM locators",
                "Depends on Tesseract accuracy",
                "May fail with stylized/image text"
            ]
        },
        "when_to_use": [
            "Shadow DOM elements that can't be pierced",
            "Canvas/SVG elements without accessible text",
            "Heavily obfuscated/dynamic elements",
            "Third-party embedded widgets",
            "Legacy apps with no semantic HTML"
        ],
        "recommendation": "Use as LAST RESORT after all DOM strategies fail"
    }



