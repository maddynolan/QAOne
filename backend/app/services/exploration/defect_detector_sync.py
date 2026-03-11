# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the Autonomous Explorer / Flowmap system which is unused.
"""
Synchronous Defect Detection (for Windows/Playwright sync)
Detects functional defects during exploration by analyzing pages and screenshots.
"""

import logging
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urlparse
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


@dataclass
class Defect:
    """Represents a detected defect."""
    defect_type: str
    severity: str
    title: str
    description: str
    page_url: str
    page_id: str
    element_selector: Optional[str] = None
    screenshot_path: Optional[str] = None
    console_errors: List[str] = field(default_factory=list)
    network_errors: List[str] = field(default_factory=list)
    evidence: Dict[str, Any] = field(default_factory=dict)
    steps_to_reproduce: List[str] = field(default_factory=list)
    expected_behavior: str = ""
    actual_behavior: str = ""
    detected_at: datetime = field(default_factory=datetime.utcnow)


def detect_defects_sync(
    page,  # Playwright sync Page object
    page_data: Dict[str, Any],
    screenshot_path: Optional[str] = None
) -> List[Defect]:
    """
    Detect defects from a page during exploration (sync version).
    
    Args:
        page: Playwright sync Page object
        page_data: Page capability data
        screenshot_path: Path to screenshot if available
    
    Returns:
        List of detected defects
    """
    defects = []
    page_url = page_data.get('url', '')
    page_id = page_data.get('id', '')
    
    logger.info(f"Detecting defects on page: {page_url}")
    
    try:
        # 0. Check console errors (critical functional issues)
        console_defects = _check_console_errors_sync(page, page_data)
        defects.extend(console_defects)
        
        # 1. Functional defects (top priority)
        func_defects = _check_functional_issues_sync(page, page_data, screenshot_path)
        defects.extend(func_defects)
        
        # 2. UI consistency defects
        ui_defects = _check_ui_consistency_sync(page, page_data, screenshot_path)
        defects.extend(ui_defects)
        
        # 3. Security defects (basic)
        sec_defects = _check_security_sync(page, page_data)
        defects.extend(sec_defects)
        
        logger.info(f"Detected {len(defects)} defects on {page_url}")
        
    except Exception as e:
        logger.error(f"Error detecting defects on {page_url}: {e}", exc_info=True)
    
    return defects


def _check_functional_issues_sync(
    page,
    page_data: Dict[str, Any],
    screenshot_path: Optional[str]
) -> List[Defect]:
    """Check for functional defects - broken elements, missing functionality, errors."""
    defects = []
    
    try:
        # 1. Check for broken buttons/links (not clickable, missing handlers)
        broken_elements = _check_broken_elements_sync(page, page_data)
        defects.extend(broken_elements)
        
        # 2. Check for missing required elements (forms without submit buttons, etc.)
        missing_elements = _check_missing_elements_sync(page, page_data)
        defects.extend(missing_elements)
        
        # 3. Check for form validation issues
        form_issues = _check_form_validation_sync(page, page_data)
        defects.extend(form_issues)
        
        # 4. Analyze screenshot for visual defects (if available)
        if screenshot_path:
            visual_defects = _analyze_screenshot_for_defects_sync(
                screenshot_path, page_data
            )
            defects.extend(visual_defects)
        
    except Exception as e:
        logger.error(f"Error checking functional issues: {e}", exc_info=True)
    
    return defects


def _check_broken_elements_sync(
    page,
    page_data: Dict[str, Any]
) -> List[Defect]:
    """Check for broken buttons, links, and interactive elements by actually testing them."""
    defects = []
    
    try:
        # Check buttons - actually test if they're clickable
        buttons = page_data.get('buttons', [])
        for button in buttons[:10]:  # Limit to first 10 to avoid too many tests
            try:
                button_text = button.get('text', '')
                if not button_text:
                    continue
                
                # Try multiple ways to find the button
                element = None
                used_selector = None
                
                # First, try to find by searching all buttons
                try:
                    all_buttons = page.query_selector_all('button, [role="button"], input[type="button"], input[type="submit"]')
                    for btn in all_buttons:
                        btn_text = btn.text_content() or btn.get_attribute('aria-label') or btn.get_attribute('value') or ''
                        if button_text.lower() in btn_text.lower() or btn_text.lower() in button_text.lower():
                            element = btn
                            used_selector = f'button with text "{button_text}"'
                            break
                except:
                    pass
                
                # If not found, try selectors
                if not element:
                    selectors_to_try = [
                        f'button:has-text("{button_text}")',
                        f'[role="button"]:has-text("{button_text}")',
                    ]
                    for selector in selectors_to_try:
                        try:
                            element = page.query_selector(selector)
                            if element:
                                used_selector = selector
                                break
                        except:
                            continue
                
                if not element:
                    # Button not found - might be a defect
                    continue  # Don't report as defect if we can't find it (might be dynamic)
                
                # Actually test if button is clickable
                try:
                    # Check if button is visible and enabled
                    if not element.is_visible():
                        defects.append(Defect(
                            defect_type='functional',
                            severity='medium',
                            title=f"Hidden Button: {button_text}",
                            description=f"Button '{button_text}' exists but is not visible",
                            page_url=page_data.get('url', ''),
                            page_id=page_data.get('id', ''),
                            element_selector=used_selector,
                            expected_behavior=f"Button '{button_text}' should be visible and clickable",
                            actual_behavior="Button is hidden",
                            evidence={'button_data': button}
                        ))
                        continue
                    
                    # Check if button is disabled
                    is_disabled = element.get_attribute('disabled') or element.evaluate('el => el.disabled')
                    if is_disabled and button_text.lower() not in ['submit', 'save', 'cancel', 'close']:
                        defects.append(Defect(
                            defect_type='functional',
                            severity='low',
                            title=f"Unexpectedly Disabled Button: {button_text}",
                            description=f"Button '{button_text}' is disabled but should be enabled",
                            page_url=page_data.get('url', ''),
                            page_id=page_data.get('id', ''),
                            element_selector=used_selector,
                            expected_behavior=f"Button '{button_text}' should be enabled",
                            actual_behavior="Button is disabled",
                            evidence={'button_data': button}
                        ))
                    
                    # Try to click the button (with timeout) to see if it works
                    # Only for non-critical buttons to avoid breaking the page
                    if button_text.lower() not in ['delete', 'remove', 'cancel order', 'logout']:
                        try:
                            # Save current URL
                            current_url = page.url
                            # Try clicking with short timeout
                            element.click(timeout=2000)
                            # Check if page changed unexpectedly (might indicate error)
                            time.sleep(0.5)
                            new_url = page.url
                            # If URL changed dramatically, might be an error
                            if new_url != current_url and 'error' in new_url.lower():
                                defects.append(Defect(
                                    defect_type='functional',
                                    severity='high',
                                    title=f"Button Click Causes Error: {button_text}",
                                    description=f"Clicking button '{button_text}' navigates to error page",
                                    page_url=page_data.get('url', ''),
                                    page_id=page_data.get('id', ''),
                                    element_selector=used_selector,
                                    expected_behavior=f"Button '{button_text}' should work correctly",
                                    actual_behavior="Button click causes error navigation",
                                    evidence={'button_data': button, 'error_url': new_url}
                                ))
                        except Exception as click_error:
                            # Click failed - might be a defect
                            if 'timeout' not in str(click_error).lower():
                                defects.append(Defect(
                                    defect_type='functional',
                                    severity='medium',
                                    title=f"Button Not Clickable: {button_text}",
                                    description=f"Button '{button_text}' cannot be clicked: {str(click_error)[:100]}",
                                    page_url=page_data.get('url', ''),
                                    page_id=page_data.get('id', ''),
                                    element_selector=used_selector,
                                    expected_behavior=f"Button '{button_text}' should be clickable",
                                    actual_behavior=f"Button click failed: {str(click_error)[:100]}",
                                    evidence={'button_data': button, 'error': str(click_error)}
                                ))
                except Exception as test_error:
                    logger.debug(f"Error testing button {button_text}: {test_error}")
                    
            except Exception as e:
                logger.debug(f"Error checking button {button.get('text', 'Unknown')}: {e}")
        
        # Test links - check if they're accessible
        links = page_data.get('links', [])
        for link in links[:10]:  # Limit to first 10
            try:
                link_text = link.get('text', '')
                href = link.get('href', '')
                if not link_text or not href:
                    continue
                
                # Skip external links and anchors
                if href.startswith('#') or href.startswith('http') and page_data.get('url', '') not in href:
                    continue
                
                # Try to find the link
                try:
                    link_element = page.query_selector(f'a:has-text("{link_text}")')
                    if link_element:
                        # Check if link is visible
                        if not link_element.is_visible():
                            defects.append(Defect(
                                defect_type='functional',
                                severity='low',
                                title=f"Hidden Link: {link_text}",
                                description=f"Link '{link_text}' exists but is not visible",
                                page_url=page_data.get('url', ''),
                                page_id=page_data.get('id', ''),
                                expected_behavior=f"Link '{link_text}' should be visible",
                                actual_behavior="Link is hidden",
                                evidence={'link_data': link}
                            ))
                except:
                    pass
                    
            except Exception as e:
                logger.debug(f"Error checking link {link.get('text', 'Unknown')}: {e}")
        
    except Exception as e:
        logger.error(f"Error checking broken elements: {e}", exc_info=True)
    
    return defects


def _check_missing_elements_sync(
    page,
    page_data: Dict[str, Any]
) -> List[Defect]:
    """Check for missing required elements (forms without submit, etc.)."""
    defects = []
    
    try:
        forms = page_data.get('forms', [])
        for form in forms:
            form_fields = form.get('fields', [])
            if form_fields:
                # Check if form has a submit button
                try:
                    submit_button = page.query_selector('form button[type="submit"], form input[type="submit"]')
                    if not submit_button:
                        defects.append(Defect(
                            defect_type='functional',
                            severity='high',
                            title="Form Missing Submit Button",
                            description=f"Form with {len(form_fields)} fields has no submit button",
                            page_url=page_data.get('url', ''),
                            page_id=page_data.get('id', ''),
                            expected_behavior="Form should have a submit button",
                            actual_behavior="Form has no submit button",
                            evidence={'form_data': form}
                        ))
                except:
                    pass
        
    except Exception as e:
        logger.error(f"Error checking missing elements: {e}", exc_info=True)
    
    return defects


def _check_form_validation_sync(
    page,
    page_data: Dict[str, Any]
) -> List[Defect]:
    """Check for form validation issues."""
    defects = []
    
    try:
        forms = page_data.get('forms', [])
        for form in forms:
            form_fields = form.get('fields', [])
            required_fields = [f for f in form_fields if f.get('required', False)]
            
            # Check if required fields have proper validation
            for field in required_fields:
                field_name = field.get('name', '')
                
                try:
                    # Check if field has HTML5 validation
                    field_element = page.query_selector(f'input[name="{field_name}"], textarea[name="{field_name}"], select[name="{field_name}"]')
                    if field_element:
                        has_required = field_element.get_attribute('required')
                        if not has_required and field.get('required'):
                            defects.append(Defect(
                                defect_type='functional',
                                severity='medium',
                                title=f"Missing Required Attribute: {field_name}",
                                description=f"Required field '{field_name}' missing HTML5 required attribute",
                                page_url=page_data.get('url', ''),
                                page_id=page_data.get('id', ''),
                                element_selector=f'[name="{field_name}"]',
                                expected_behavior=f"Field '{field_name}' should have required attribute",
                                actual_behavior="Field missing required attribute",
                                evidence={'field_data': field}
                            ))
                except:
                    pass
        
    except Exception as e:
        logger.error(f"Error checking form validation: {e}", exc_info=True)
    
    return defects


def _analyze_screenshot_for_defects_sync(
    screenshot_path: str,
    page_data: Dict[str, Any]
) -> List[Defect]:
    """Analyze screenshot for visual/functional defects."""
    defects = []
    
    try:
        # Load screenshot
        img = Image.open(screenshot_path)
        img_array = np.array(img)
        
        # 1. Check for blank/white screen (potential error page)
        if _is_mostly_white(img_array):
            defects.append(Defect(
                defect_type='functional',
                severity='critical',
                title="Blank/White Screen Detected",
                description="Page appears to be blank or showing error screen",
                page_url=page_data.get('url', ''),
                page_id=page_data.get('id', ''),
                screenshot_path=screenshot_path,
                expected_behavior="Page should display content",
                actual_behavior="Page appears blank or white",
                evidence={'screenshot_analysis': 'mostly_white'}
            ))
        
        # 2. Check for layout issues (very basic)
        if img_array.shape[0] < 100 or img_array.shape[1] < 100:
            defects.append(Defect(
                defect_type='ui_consistency',
                severity='medium',
                title="Unusual Page Dimensions",
                description=f"Page has unusual dimensions: {img_array.shape[1]}x{img_array.shape[0]}",
                page_url=page_data.get('url', ''),
                page_id=page_data.get('id', ''),
                screenshot_path=screenshot_path,
                expected_behavior="Page should have normal dimensions",
                actual_behavior=f"Page has dimensions {img_array.shape[1]}x{img_array.shape[0]}",
                evidence={'dimensions': img_array.shape}
            ))
        
    except Exception as e:
        logger.error(f"Error analyzing screenshot: {e}", exc_info=True)
    
    return defects


def _is_mostly_white(img_array: np.ndarray, threshold: float = 0.95) -> bool:
    """Check if image is mostly white (potential error page)."""
    try:
        # Convert to grayscale if needed
        if len(img_array.shape) == 3:
            gray = np.mean(img_array, axis=2)
        else:
            gray = img_array
        
        # Check percentage of white pixels (increased threshold to reduce false positives)
        white_pixels = np.sum(gray > 245)  # Very light pixels (increased from 240)
        total_pixels = gray.size
        white_ratio = white_pixels / total_pixels
        
        # Also check for very low variance (uniform color = likely blank)
        variance = np.var(gray)
        is_uniform = variance < 100  # Very low variance = uniform color
        
        # Only report as blank if BOTH conditions: mostly white AND uniform
        return white_ratio > threshold and is_uniform
    except:
        return False


def _check_ui_consistency_sync(
    page,
    page_data: Dict[str, Any],
    screenshot_path: Optional[str]
) -> List[Defect]:
    """Check for UI consistency issues."""
    defects = []
    
    try:
        # Check for missing titles
        title = page_data.get('title', '')
        if not title or title.lower() in ['untitled', '']:
            defects.append(Defect(
                defect_type='ui_consistency',
                severity='low',
                title="Missing Page Title",
                description="Page has no title or untitled",
                page_url=page_data.get('url', ''),
                page_id=page_data.get('id', ''),
                expected_behavior="Page should have a descriptive title",
                actual_behavior="Page title is missing or empty",
                evidence={'title': title}
            ))
        
    except Exception as e:
        logger.error(f"Error checking UI consistency: {e}", exc_info=True)
    
    return defects


def _check_console_errors_sync(
    page,
    page_data: Dict[str, Any]
) -> List[Defect]:
    """Check for JavaScript console errors (critical functional issues)."""
    defects = []
    
    try:
        # Get console messages (errors and warnings)
        console_messages = []
        try:
            # Listen for console messages
            def handle_console(msg):
                console_messages.append({
                    'type': msg.type,
                    'text': msg.text
                })
            
            # Note: Playwright sync API doesn't have easy console listener
            # We'll check page errors instead
            page.on('console', handle_console)
        except:
            pass
        
        # Check for common error indicators in page content
        try:
            page_content = page.content()
            
            # Check for error messages in HTML
            error_indicators = [
                'error',
                'exception',
                'failed',
                'not found',
                '404',
                '500',
                'internal server error'
            ]
            
            content_lower = page_content.lower()
            for indicator in error_indicators:
                if indicator in content_lower:
                    # Check if it's actually an error (not just in a comment or script)
                    # Simple heuristic: check if it's in visible text
                    try:
                        body_element = page.query_selector('body')
                        body_text = (body_element.text_content().lower() if body_element else '') or ''
                        if indicator in body_text:
                            defects.append(Defect(
                                defect_type='functional',
                                severity='high',
                                title=f"Error Message Detected: {indicator}",
                                description=f"Page contains error message: '{indicator}'",
                                page_url=page_data.get('url', ''),
                                page_id=page_data.get('id', ''),
                                expected_behavior="Page should load without errors",
                                actual_behavior=f"Error message '{indicator}' detected on page",
                                evidence={'error_indicator': indicator}
                            ))
                            break  # Only report one error per page
                    except:
                        pass
        except:
            pass
        
    except Exception as e:
        logger.debug(f"Error checking console errors: {e}")
    
    return defects


def _check_security_sync(
    page,
    page_data: Dict[str, Any]
) -> List[Defect]:
    """Check for basic security issues."""
    defects = []
    
    try:
        # Check for forms without HTTPS (if on HTTPS page)
        forms = page_data.get('forms', [])
        page_url = page_data.get('url', '')
        
        if page_url.startswith('https://'):
            for form in forms:
                form_action = form.get('action', '')
                if form_action and form_action.startswith('http://'):
                    defects.append(Defect(
                        defect_type='security',
                        severity='high',
                        title="Insecure Form Submission",
                        description=f"Form submits to HTTP instead of HTTPS",
                        page_url=page_url,
                        page_id=page_data.get('id', ''),
                        expected_behavior="Form should submit to HTTPS",
                        actual_behavior=f"Form submits to {form_action}",
                        evidence={'form_action': form_action}
                    ))
        
    except Exception as e:
        logger.error(f"Error checking security: {e}", exc_info=True)
    
    return defects

