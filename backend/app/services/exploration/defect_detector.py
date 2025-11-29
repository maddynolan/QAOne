"""
Defect Detection Service
Detects functional defects during exploration by analyzing pages, screenshots, and behavior.
Focuses on functional issues: broken elements, missing functionality, errors, etc.
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urlparse
import base64
import io
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Defect:
    """Represents a detected defect."""
    defect_type: str  # functional, performance, security, ui_consistency
    severity: str  # critical, high, medium, low
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


class DefectDetector:
    """
    Detects defects during exploration by analyzing pages, screenshots, and behavior.
    Focuses on functional defects: broken elements, missing functionality, errors.
    """
    
    def __init__(self):
        self.detected_defects: List[Defect] = []
    
    async def detect_defects(
        self,
        page,  # Playwright Page object
        page_data: Dict[str, Any],
        screenshot_path: Optional[str] = None
    ) -> List[Defect]:
        """
        Detect defects from a page during exploration.
        
        Args:
            page: Playwright Page object
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
            # 1. Functional defects (top priority)
            func_defects = await self._check_functional_issues(page, page_data, screenshot_path)
            defects.extend(func_defects)
            
            # 2. UI consistency defects
            ui_defects = await self._check_ui_consistency(page, page_data, screenshot_path)
            defects.extend(ui_defects)
            
            # 3. Performance defects (basic)
            perf_defects = await self._check_performance(page, page_data)
            defects.extend(perf_defects)
            
            # 4. Security defects (basic)
            sec_defects = await self._check_security(page, page_data)
            defects.extend(sec_defects)
            
            logger.info(f"Detected {len(defects)} defects on {page_url}")
            self.detected_defects.extend(defects)
            
        except Exception as e:
            logger.error(f"Error detecting defects on {page_url}: {e}", exc_info=True)
        
        return defects
    
    async def _check_functional_issues(
        self,
        page,
        page_data: Dict[str, Any],
        screenshot_path: Optional[str]
    ) -> List[Defect]:
        """Check for functional defects - broken elements, missing functionality, errors."""
        defects = []
        
        try:
            # 1. Check for JavaScript errors
            console_errors = await self._get_console_errors(page)
            if console_errors:
                for error in console_errors:
                    defects.append(Defect(
                        defect_type='functional',
                        severity='high' if 'error' in error.lower() else 'medium',
                        title=f"JavaScript Error: {error[:100]}",
                        description=f"Console error detected: {error}",
                        page_url=page_data.get('url', ''),
                        page_id=page_data.get('id', ''),
                        console_errors=[error],
                        screenshot_path=screenshot_path,
                        expected_behavior="Page should load without JavaScript errors",
                        actual_behavior=f"JavaScript error: {error}",
                        evidence={'console_error': error}
                    ))
            
            # 2. Check for broken links (404s, network errors)
            network_errors = await self._get_network_errors(page)
            if network_errors:
                for error in network_errors:
                    defects.append(Defect(
                        defect_type='functional',
                        severity='medium',
                        title=f"Network Error: {error.get('url', 'Unknown')}",
                        description=f"Failed to load resource: {error.get('error', 'Unknown error')}",
                        page_url=page_data.get('url', ''),
                        page_id=page_data.get('id', ''),
                        network_errors=[error.get('url', '')],
                        screenshot_path=screenshot_path,
                        expected_behavior="All resources should load successfully",
                        actual_behavior=f"Resource failed to load: {error.get('error', '')}",
                        evidence={'network_error': error}
                    ))
            
            # 3. Check for broken buttons/links (not clickable, missing handlers)
            broken_elements = await self._check_broken_elements(page, page_data)
            defects.extend(broken_elements)
            
            # 4. Check for missing required elements (forms without submit buttons, etc.)
            missing_elements = await self._check_missing_elements(page, page_data)
            defects.extend(missing_elements)
            
            # 5. Check for form validation issues
            form_issues = await self._check_form_validation(page, page_data)
            defects.extend(form_issues)
            
            # 6. Analyze screenshot for visual defects (if available)
            if screenshot_path:
                visual_defects = await self._analyze_screenshot_for_defects(
                    screenshot_path, page_data
                )
                defects.extend(visual_defects)
            
        except Exception as e:
            logger.error(f"Error checking functional issues: {e}", exc_info=True)
        
        return defects
    
    async def _get_console_errors(self, page) -> List[str]:
        """Get JavaScript console errors."""
        errors = []
        try:
            # Get console messages
            console_messages = []
            
            def handle_console(msg):
                if msg.type == 'error':
                    console_messages.append(msg.text)
            
            page.on('console', handle_console)
            
            # Wait a bit for errors to accumulate
            await asyncio.sleep(1)
            
            # Also check for uncaught exceptions
            try:
                page_errors = await page.evaluate("""
                    () => {
                        if (window.errors) {
                            return window.errors;
                        }
                        return [];
                    }
                """)
                errors.extend(page_errors)
            except:
                pass
            
            errors.extend(console_messages)
            
        except Exception as e:
            logger.debug(f"Error getting console errors: {e}")
        
        return errors
    
    async def _get_network_errors(self, page) -> List[Dict[str, Any]]:
        """Get network errors (failed requests)."""
        errors = []
        try:
            # Listen for failed requests
            failed_requests = []
            
            def handle_request_failed(request):
                failed_requests.append({
                    'url': request.url,
                    'error': 'Request failed',
                    'method': request.method
                })
            
            def handle_response(response):
                if response.status >= 400:
                    failed_requests.append({
                        'url': response.url,
                        'error': f"HTTP {response.status}",
                        'method': response.request.method,
                        'status': response.status
                    })
            
            page.on('requestfailed', handle_request_failed)
            page.on('response', handle_response)
            
            # Wait a bit for network activity
            await asyncio.sleep(2)
            
            errors = failed_requests
            
        except Exception as e:
            logger.debug(f"Error getting network errors: {e}")
        
        return errors
    
    async def _check_broken_elements(
        self,
        page,
        page_data: Dict[str, Any]
    ) -> List[Defect]:
        """Check for broken buttons, links, and interactive elements."""
        defects = []
        
        try:
            # Check buttons
            buttons = page_data.get('buttons', [])
            for button in buttons:
                try:
                    selector = button.get('selector', '')
                    if not selector:
                        continue
                    
                    # Try to find the button
                    element = await page.query_selector(selector)
                    if not element:
                        defects.append(Defect(
                            defect_type='functional',
                            severity='medium',
                            title=f"Broken Button: {button.get('text', 'Unknown')}",
                            description=f"Button '{button.get('text')}' not found on page",
                            page_url=page_data.get('url', ''),
                            page_id=page_data.get('id', ''),
                            element_selector=selector,
                            expected_behavior=f"Button '{button.get('text')}' should be present and clickable",
                            actual_behavior="Button not found on page",
                            evidence={'button_data': button}
                        ))
                    else:
                        # Check if button is disabled without reason
                        is_disabled = await element.get_attribute('disabled')
                        if is_disabled and button.get('text', '').lower() not in ['submit', 'save', 'cancel']:
                            defects.append(Defect(
                                defect_type='functional',
                                severity='low',
                                title=f"Unexpectedly Disabled Button: {button.get('text', 'Unknown')}",
                                description=f"Button '{button.get('text')}' is disabled but should be enabled",
                                page_url=page_data.get('url', ''),
                                page_id=page_data.get('id', ''),
                                element_selector=selector,
                                expected_behavior=f"Button '{button.get('text')}' should be enabled",
                                actual_behavior="Button is disabled",
                                evidence={'button_data': button}
                            ))
                except Exception as e:
                    logger.debug(f"Error checking button {button.get('text')}: {e}")
            
            # Check links
            links = page_data.get('links', [])
            for link in links:
                try:
                    href = link.get('href', '')
                    if not href or href.startswith('#'):
                        continue
                    
                    # Check if link is broken (relative links need to be checked differently)
                    if href.startswith('http'):
                        # External link - check if it's accessible
                        try:
                            response = await page.goto(href, wait_until='domcontentloaded', timeout=5000)
                            if response and response.status >= 400:
                                defects.append(Defect(
                                    defect_type='functional',
                                    severity='medium',
                                    title=f"Broken Link: {link.get('text', 'Unknown')}",
                                    description=f"Link '{link.get('text')}' returns {response.status}",
                                    page_url=page_data.get('url', ''),
                                    page_id=page_data.get('id', ''),
                                    element_selector=f"a[href='{href}']",
                                    expected_behavior=f"Link '{link.get('text')}' should be accessible",
                                    actual_behavior=f"Link returns HTTP {response.status}",
                                    evidence={'link_data': link, 'status': response.status}
                                ))
                        except:
                            # Link might be broken
                            defects.append(Defect(
                                defect_type='functional',
                                severity='medium',
                                title=f"Broken Link: {link.get('text', 'Unknown')}",
                                description=f"Link '{link.get('text')}' failed to load",
                                page_url=page_data.get('url', ''),
                                page_id=page_data.get('id', ''),
                                element_selector=f"a[href='{href}']",
                                expected_behavior=f"Link '{link.get('text')}' should be accessible",
                                actual_behavior="Link failed to load",
                                evidence={'link_data': link}
                            ))
                except Exception as e:
                    logger.debug(f"Error checking link {link.get('text')}: {e}")
        
        except Exception as e:
            logger.error(f"Error checking broken elements: {e}", exc_info=True)
        
        return defects
    
    async def _check_missing_elements(
        self,
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
                        submit_button = await page.query_selector('form button[type="submit"], form input[type="submit"]')
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
    
    async def _check_form_validation(
        self,
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
                    field_type = field.get('type', 'text')
                    
                    try:
                        # Check if field has HTML5 validation
                        field_element = await page.query_selector(f'input[name="{field_name}"], textarea[name="{field_name}"], select[name="{field_name}"]')
                        if field_element:
                            has_required = await field_element.get_attribute('required')
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
    
    async def _analyze_screenshot_for_defects(
        self,
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
            if self._is_mostly_white(img_array):
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
            
            # 2. Check for error messages in screenshot (basic text detection)
            # This would require OCR - for now, we'll skip detailed text analysis
            # but can be enhanced later
            
            # 3. Check for layout issues (very basic)
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
    
    def _is_mostly_white(self, img_array: np.ndarray, threshold: float = 0.9) -> bool:
        """Check if image is mostly white (potential error page)."""
        try:
            # Convert to grayscale if needed
            if len(img_array.shape) == 3:
                gray = np.mean(img_array, axis=2)
            else:
                gray = img_array
            
            # Check percentage of white pixels
            white_pixels = np.sum(gray > 240)  # Very light pixels
            total_pixels = gray.size
            white_ratio = white_pixels / total_pixels
            
            return white_ratio > threshold
        except:
            return False
    
    async def _check_ui_consistency(
        self,
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
    
    async def _check_performance(
        self,
        page,
        page_data: Dict[str, Any]
    ) -> List[Defect]:
        """Check for basic performance issues."""
        defects = []
        
        try:
            # Check page load time (basic)
            # This would be better measured during actual navigation
            # For now, we'll skip detailed performance checks
            pass
        
        except Exception as e:
            logger.error(f"Error checking performance: {e}", exc_info=True)
        
        return defects
    
    async def _check_security(
        self,
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

