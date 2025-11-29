"""
Autonomous App Explorer
Systematically navigates through an application to build a comprehensive capability map.
Uses BFS/DFS exploration strategies to discover pages, forms, actions, and flows.
"""

import logging
import asyncio
import platform
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from collections import deque
import re
from urllib.parse import urljoin, urlparse

# Use sync Playwright on Windows (same as Flowstral), async on other platforms
if platform.system() == "Windows":
    from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
    USE_SYNC_PLAYWRIGHT = True
else:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext
    USE_SYNC_PLAYWRIGHT = False

logger = logging.getLogger(__name__)


@dataclass
class PageCapability:
    """Represents a discovered page and its capabilities."""
    id: str
    url: str
    url_pattern: Optional[str] = None
    title: str = ""
    headings: List[str] = field(default_factory=list)
    buttons: List[Dict[str, Any]] = field(default_factory=list)
    links: List[Dict[str, Any]] = field(default_factory=list)
    forms: List[Dict[str, Any]] = field(default_factory=list)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    entities: List[str] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    screenshots: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    discovered_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ExplorationConfig:
    """Configuration for autonomous exploration."""
    base_url: str
    max_depth: int = 5
    max_pages: int = 100
    allowed_domains: List[str] = field(default_factory=list)
    excluded_paths: List[str] = field(default_factory=lambda: [
        '/logout', '/api/', '/static/', '/assets/', '/_next/', '/admin/'
    ])
    excluded_patterns: List[str] = field(default_factory=lambda: [
        r'\.(pdf|zip|jpg|png|gif|css|js)$',
        r'#',
        r'\?.*logout',
    ])
    login_flow: Optional[Dict[str, Any]] = None  # {url, username_selector, password_selector, submit_selector}
    wait_timeout: int = 30000  # Increased from 5000ms to 30s for slow sites
    screenshot: bool = True
    headless: bool = True
    delay_between_pages: float = 3.0  # Seconds to wait between page navigations (ethical/legal)
    respect_robots_txt: bool = True  # Check robots.txt before exploring
    user_agent: str = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'  # Realistic browser UA


class AutonomousExplorer:
    """
    Autonomous agent that systematically explores an application.
    Uses BFS/DFS to discover pages, extract capabilities, and build a capability map.
    """
    
    def __init__(self, config: ExplorationConfig):
        self.config = config
        self.visited_urls: Set[str] = set()
        self.discovered_pages: Dict[str, PageCapability] = {}
        self.exploration_queue: deque = deque()
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.detected_defects: List = []  # Store defects detected during exploration
        
        # Parse base domain for allowed domains
        if not self.config.allowed_domains:
            parsed = urlparse(self.config.base_url)
            self.config.allowed_domains = [parsed.netloc]
    
    async def explore(self) -> Dict[str, Any]:
        """
        Main exploration entry point.
        Returns a capability map of the discovered application.
        """
        logger.info(f"Starting autonomous exploration of {self.config.base_url}")
        
        # Phase 1: Pre-exploration LLM analysis
        initial_analysis = None
        try:
            from app.services.exploration.llm_application_analyzer import LLMApplicationAnalyzer
            llm_analyzer = LLMApplicationAnalyzer()
            logger.info("Calling LLM analyze_url...")
            initial_analysis = await llm_analyzer.analyze_url(self.config.base_url)
            logger.info(f"Initial LLM analysis: {initial_analysis.get('domain')} (confidence: {initial_analysis.get('confidence')})")
            
            # Adjust exploration strategy based on initial analysis
            if initial_analysis.get('exploration_focus'):
                logger.info(f"Focusing exploration on: {initial_analysis.get('exploration_focus')}")
        except Exception as e:
            logger.error(f"Initial LLM analysis failed: {e}", exc_info=True)
            logger.warning("Continuing with standard exploration")
        
        try:
            # On Windows, use sync_playwright in thread pool (same approach as Flowstral)
            import platform
            is_windows = platform.system() == "Windows"
            logger.info(f"Platform check: {platform.system()}, USE_SYNC_PLAYWRIGHT={USE_SYNC_PLAYWRIGHT}, is_windows={is_windows}")
            
            if USE_SYNC_PLAYWRIGHT or is_windows:
                logger.info("Windows detected: Using sync_playwright with asyncio.to_thread (Windows-compatible)")
                
                def run_exploration_sync():
                    """Run exploration using sync Playwright (Windows-compatible)"""
                    import sys
                    import asyncio
                    from playwright.sync_api import sync_playwright
                    
                    # Set event loop policy for Windows BEFORE importing/using sync_playwright
                    if sys.platform == "win32":
                        # Set the event loop policy for this thread BEFORE Playwright initializes
                        # This must happen before sync_playwright() creates its internal event loop
                        try:
                            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                        except Exception as e:
                            logger.warning(f"Could not set event loop policy: {e}")
                    
                    from app.services.exploration.autonomous_explorer_sync_helpers import (
                        perform_login_sync,
                        extract_page_capabilities_sync
                    )
                    
                    # Now use sync_playwright - it will use the policy we just set
                    with sync_playwright() as p:
                        browser = p.chromium.launch(headless=self.config.headless)
                        context = browser.new_context(
                            viewport={'width': 1920, 'height': 1080},
                            user_agent=self.config.user_agent
                        )
                        page = context.new_page()
                        
                        try:
                            # Step 1: Login if configured
                            if self.config.login_flow:
                                perform_login_sync(page, self.config.login_flow, self.config.base_url)
                            
                            # Step 2: Start exploration from base URL
                            self._explore_page_sync(page, self.config.base_url, depth=0)
                            
                            # Step 3: BFS exploration
                            while self.exploration_queue and len(self.discovered_pages) < self.config.max_pages:
                                url, depth = self.exploration_queue.popleft()
                                
                                if depth >= self.config.max_depth:
                                    continue
                                
                                if url not in self.visited_urls:
                                    # Add delay between pages to be respectful (ethical/legal)
                                    import time
                                    time.sleep(self.config.delay_between_pages)
                                    self._explore_page_sync(page, url, depth)
                            
                            # Step 4: Mid-exploration LLM analysis (if enough pages discovered)
                            structure_analysis = None
                            if len(self.discovered_pages) >= 5:
                                try:
                                    # Create new event loop for async LLM calls
                                    # Note: We're in a sync context, so we need a new event loop
                                    loop = asyncio.new_event_loop()
                                    asyncio.set_event_loop(loop)
                                    
                                    from app.services.exploration.llm_application_analyzer import LLMApplicationAnalyzer
                                    llm_analyzer = LLMApplicationAnalyzer()
                                    
                                    # Collect page data for analysis
                                    pages_data = []
                                    all_headings = []
                                    all_buttons = []
                                    all_forms = []
                                    all_links = []
                                    
                                    for page_cap in self.discovered_pages.values():
                                        pages_data.append({
                                            'url': page_cap.url,
                                            'title': page_cap.title,
                                            'headings': page_cap.headings
                                        })
                                        all_headings.extend(page_cap.headings)
                                        all_buttons.extend([b.get('text', '') if isinstance(b, dict) else str(b) for b in page_cap.buttons])
                                        all_links.extend([l.get('text', '') if isinstance(l, dict) else str(l) for l in page_cap.links])
                                        all_forms.extend(page_cap.forms)
                                    
                                    structure_analysis = loop.run_until_complete(
                                        llm_analyzer.analyze_structure(
                                            base_url=self.config.base_url,
                                            pages=pages_data,
                                            headings=list(set(all_headings)),
                                            buttons=list(set(all_buttons)),
                                            forms=all_forms,
                                            links=list(set(all_links)),
                                            initial_analysis=initial_analysis
                                        )
                                    )
                                    
                                    logger.info(f"Mid-exploration LLM analysis: {structure_analysis.get('domain')}, {len(structure_analysis.get('primary_entities', []))} entities")
                                except Exception as e:
                                    logger.warning(f"Mid-exploration LLM analysis failed: {e}, continuing", exc_info=True)
                                finally:
                                    # Clean up event loop
                                    try:
                                        if 'loop' in locals():
                                            loop.close()
                                    except Exception as cleanup_error:
                                        logger.warning(f"Error closing event loop: {cleanup_error}")
                            
                            # Step 5: Build capability map
                            capability_map = self._build_capability_map()
                            
                            # Add LLM analysis to capability map
                            if structure_analysis:
                                capability_map['llm_analysis'] = structure_analysis
                            if initial_analysis:
                                capability_map['initial_analysis'] = initial_analysis
                            
                            logger.info(f"Exploration complete: {len(self.discovered_pages)} pages discovered")
                            return capability_map
                        finally:
                            browser.close()
                
                # Use asyncio.to_thread() instead of run_in_executor for better Windows compatibility
                capability_map = await asyncio.to_thread(run_exploration_sync)
                return capability_map
            else:
                # Linux/Mac: Use async Playwright
                logger.debug("Using async_playwright (non-Windows)")
                async with async_playwright() as p:
                    try:
                        self.browser = await p.chromium.launch(headless=self.config.headless)
                    except Exception as launch_error:
                        error_msg = f"Failed to launch browser: {launch_error}"
                        logger.error(error_msg)
                        raise Exception(error_msg) from launch_error
                    
                    try:
                        self.context = await self.browser.new_context(
                            viewport={'width': 1920, 'height': 1080},
                            user_agent=self.config.user_agent
                        )
                        self.page = await self.context.new_page()
                    except Exception as context_error:
                        error_msg = f"Failed to create browser context: {context_error}"
                        logger.error(error_msg)
                        await self.browser.close()
                        raise Exception(error_msg) from context_error
                    
                    try:
                        # Step 1: Login if configured
                        if self.config.login_flow:
                            await self._perform_login()
                        
                        # Step 2: Start exploration from base URL
                        await self._explore_page(self.config.base_url, depth=0)
                        
                        # Step 3: BFS exploration
                        while self.exploration_queue and len(self.discovered_pages) < self.config.max_pages:
                            url, depth = self.exploration_queue.popleft()
                            
                            if depth >= self.config.max_depth:
                                continue
                            
                            if url not in self.visited_urls:
                                # Add delay between pages to be respectful (ethical/legal)
                                await asyncio.sleep(self.config.delay_between_pages)
                                await self._explore_page(url, depth)
                        
                        # Step 4: Mid-exploration LLM analysis (if enough pages discovered)
                        structure_analysis = None
                        if len(self.discovered_pages) >= 5:
                            try:
                                from app.services.exploration.llm_application_analyzer import LLMApplicationAnalyzer
                                llm_analyzer = LLMApplicationAnalyzer()
                                
                                # Collect page data for analysis
                                pages_data = []
                                all_headings = []
                                all_buttons = []
                                all_forms = []
                                all_links = []
                                
                                for page_cap in self.discovered_pages.values():
                                    pages_data.append({
                                        'url': page_cap.url,
                                        'title': page_cap.title,
                                        'headings': page_cap.headings
                                    })
                                    all_headings.extend(page_cap.headings)
                                    all_buttons.extend([b.get('text', '') if isinstance(b, dict) else str(b) for b in page_cap.buttons])
                                    all_links.extend([l.get('text', '') if isinstance(l, dict) else str(l) for l in page_cap.links])
                                    all_forms.extend(page_cap.forms)
                                
                                structure_analysis = await llm_analyzer.analyze_structure(
                                    base_url=self.config.base_url,
                                    pages=pages_data,
                                    headings=list(set(all_headings)),
                                    buttons=list(set(all_buttons)),
                                    forms=all_forms,
                                    links=list(set(all_links)),
                                    initial_analysis=initial_analysis
                                )
                                
                                logger.info(f"Mid-exploration LLM analysis: {structure_analysis.get('domain')}, {len(structure_analysis.get('primary_entities', []))} entities")
                            except Exception as e:
                                logger.warning(f"Mid-exploration LLM analysis failed: {e}, continuing")
                        
                        # Step 5: Build capability map
                        capability_map = self._build_capability_map()
                        
                        # Add LLM analysis to capability map
                        if structure_analysis:
                            capability_map['llm_analysis'] = structure_analysis
                        if initial_analysis:
                            capability_map['initial_analysis'] = initial_analysis
                        
                        logger.info(f"Exploration complete: {len(self.discovered_pages)} pages discovered")
                        return capability_map
                        
                    except Exception as exploration_error:
                        logger.error(f"Exploration error: {exploration_error}", exc_info=True)
                        raise
                    finally:
                        if self.browser:
                            await self.browser.close()
        except ImportError as import_error:
            error_msg = f"Playwright not installed. Install with: pip install playwright && playwright install chromium"
            logger.error(error_msg)
            logger.error(f"Import error: {import_error}")
            raise Exception(error_msg) from import_error
        except Exception as e:
            logger.error(f"Exploration failed: {e}", exc_info=True)
            raise
    
    async def _perform_login(self) -> None:
        """Perform login flow if configured."""
        login = self.config.login_flow
        logger.info(f"Performing login at {login.get('url', self.config.base_url)}")
        
        await self.page.goto(login.get('url', self.config.base_url), wait_until='domcontentloaded', timeout=60000)
        
        # Fill username
        if login.get('username_selector'):
            await self.page.fill(login['username_selector'], login.get('username', ''))
        
        # Fill password
        if login.get('password_selector'):
            await self.page.fill(login['password_selector'], login.get('password', ''))
        
        # Submit
        if login.get('submit_selector'):
            await self.page.click(login['submit_selector'])
            await self.page.wait_for_load_state('networkidle')
        
        logger.info("Login completed")
    
    async def _explore_page(self, url: str, depth: int) -> None:
        """Explore a single page and extract its capabilities."""
        if url in self.visited_urls:
            return
        
        # Check if URL should be excluded
        if self._should_exclude_url(url):
            return
        
        logger.info(f"Exploring page (depth {depth}): {url}")
        
        try:
            # Navigate to page - use domcontentloaded for faster, more reliable loading
            # networkidle often never completes on sites with heavy analytics/background requests
            navigation_success = False
            try:
                await self.page.goto(url, wait_until='domcontentloaded', timeout=self.config.wait_timeout)
                navigation_success = True
                logger.debug(f"Navigation to {url} succeeded with domcontentloaded")
            except Exception as nav_error:
                logger.warning(f"Navigation to {url} failed: {nav_error}")
                # Try to extract content anyway - page might have partially loaded
                try:
                    # Check if page is accessible
                    await self.page.wait_for_load_state('domcontentloaded', timeout=5000)
                    navigation_success = True
                    logger.debug(f"Page {url} accessible after timeout")
                except:
                    logger.warning(f"Page {url} not accessible, skipping")
                    self.visited_urls.add(url)  # Mark as visited to avoid retries
                    return
            
            # Wait a bit for dynamic content to load (but don't wait for networkidle)
            await asyncio.sleep(2)
            
            # Extract page capabilities - do this even if navigation had issues
            try:
                page_cap = await self._extract_page_capabilities(url)
                page_cap.metadata['depth'] = depth
                page_cap.metadata['navigation_success'] = navigation_success
                
                # Detect defects on this page
                try:
                    from app.services.exploration.defect_detector import DefectDetector
                    defect_detector = DefectDetector()
                    
                    # Take screenshot if enabled
                    screenshot_path = None
                    if self.config.screenshot:
                        screenshot_path = f"exploration_screenshots/{page_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.png"
                        try:
                            await self.page.screenshot(path=screenshot_path, full_page=True)
                        except:
                            screenshot_path = None
                    
                    # Convert PageCapability to dict for defect detector
                    from dataclasses import asdict
                    page_data = asdict(page_cap)
                    
                    # Detect defects
                    defects = await defect_detector.detect_defects(
                        self.page,
                        page_data,
                        screenshot_path
                    )
                    
                    # Store defects
                    if defects:
                        page_cap.metadata['defects'] = len(defects)
                        if not hasattr(self, 'detected_defects'):
                            self.detected_defects = []
                        self.detected_defects.extend(defects)
                        logger.info(f"Detected {len(defects)} defects on {url}")
                except Exception as defect_error:
                    logger.warning(f"Error detecting defects on {url}: {defect_error}")
                
                # Store discovered page
                page_id = self._generate_page_id(url)
                self.discovered_pages[page_id] = page_cap
                self.visited_urls.add(url)
                
                # Extract links for further exploration
                links = await self._extract_links()
                
                # Add new links to exploration queue
                for link_url in links:
                    if link_url not in self.visited_urls and depth < self.config.max_depth:
                        self.exploration_queue.append((link_url, depth + 1))
                
                logger.debug(f"Page {url}: {len(links)} links found, {len(self.exploration_queue)} in queue")
            except Exception as extract_error:
                logger.warning(f"Failed to extract capabilities from {url}: {extract_error}")
                # Still mark as visited to avoid infinite retries
                self.visited_urls.add(url)
            
        except Exception as e:
            logger.warning(f"Failed to explore page {url}: {e}", exc_info=True)
            # Mark as visited to avoid infinite retries
            self.visited_urls.add(url)
    
    async def _extract_page_capabilities(self, url: str) -> PageCapability:
        """Extract all capabilities from the current page."""
        page_id = self._generate_page_id(url)
        
        # Extract basic page info
        title = await self.page.title()
        headings = await self._extract_headings()
        buttons = await self._extract_buttons()
        links = await self._extract_links()
        forms = await self._extract_forms()
        tables = await self._extract_tables()
        entities = await self._extract_entities(headings, buttons, forms)
        actions = await self._extract_actions(buttons, links)
        
        # Take screenshot if enabled
        screenshots = []
        if self.config.screenshot:
            screenshot_path = f"exploration_screenshots/{page_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.png"
            await self.page.screenshot(path=screenshot_path, full_page=True)
            screenshots.append(screenshot_path)
        
        return PageCapability(
            id=page_id,
            url=url,
            url_pattern=self._extract_url_pattern(url),
            title=title,
            headings=headings,
            buttons=buttons,
            links=links,
            forms=forms,
            tables=tables,
            entities=entities,
            actions=actions,
            screenshots=screenshots
        )
    
    async def _extract_headings(self) -> List[str]:
        """Extract all headings from the page."""
        headings = []
        for level in range(1, 7):
            elements = await self.page.query_selector_all(f'h{level}')
            for elem in elements:
                text = await elem.text_content()
                if text and text.strip():
                    headings.append(text.strip())
        return headings
    
    async def _extract_buttons(self) -> List[Dict[str, Any]]:
        """Extract all buttons and their properties."""
        buttons = []
        button_selectors = [
            'button',
            '[role="button"]',
            'input[type="button"]',
            'input[type="submit"]',
            'a.button',
            '[class*="button"]'
        ]
        
        for selector in button_selectors:
            elements = await self.page.query_selector_all(selector)
            for elem in elements:
                try:
                    text = await elem.text_content()
                    aria_label = await elem.get_attribute('aria-label')
                    button_id = await elem.get_attribute('id')
                    classes = await elem.get_attribute('class')
                    
                    buttons.append({
                        'text': text.strip() if text else '',
                        'aria_label': aria_label or '',
                        'id': button_id or '',
                        'classes': classes or '',
                        'selector': selector
                    })
                except:
                    continue
        
        return buttons
    
    def _explore_page_sync(self, page, url: str, depth: int) -> None:
        """Explore a single page using sync Playwright (Windows-compatible)"""
        if url in self.visited_urls:
            return
        
        # Check if URL should be excluded
        if self._should_exclude_url(url):
            return
        
        logger.info(f"Exploring page (depth {depth}): {url}")
        
        try:
            # Navigate to page - use domcontentloaded for faster, more reliable loading
            # networkidle often never completes on sites with heavy analytics/background requests
            import time
            navigation_success = False
            try:
                page.goto(url, wait_until='domcontentloaded', timeout=self.config.wait_timeout)
                navigation_success = True
                logger.debug(f"Navigation to {url} succeeded with domcontentloaded")
            except Exception as nav_error:
                logger.warning(f"Navigation to {url} failed: {nav_error}")
                # Try to extract content anyway - page might have partially loaded
                try:
                    # Check if page is accessible
                    page.wait_for_load_state('domcontentloaded', timeout=5000)
                    navigation_success = True
                    logger.debug(f"Page {url} accessible after timeout")
                except:
                    logger.warning(f"Page {url} not accessible, skipping")
                    self.visited_urls.add(url)  # Mark as visited to avoid retries
                    return
            
            # Wait a bit for dynamic content to load (but don't wait for networkidle)
            time.sleep(2)
            
            # Extract page capabilities - do this even if navigation had issues
            try:
                from app.services.exploration.autonomous_explorer_sync_helpers import extract_page_capabilities_sync
                page_data = extract_page_capabilities_sync(page, url, self.config)
                
                # Convert to PageCapability object
                from dataclasses import asdict
                page_cap = PageCapability(**page_data)
                page_cap.metadata['depth'] = depth
                page_cap.metadata['navigation_success'] = navigation_success
                
                # Detect defects on this page (sync version)
                try:
                    from app.services.exploration.defect_detector_sync import detect_defects_sync
                    
                    # Take screenshot if enabled
                    screenshot_path = None
                    if self.config.screenshot:
                        page_id_for_screenshot = self._generate_page_id(url)
                        screenshot_path = f"exploration_screenshots/{page_id_for_screenshot}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.png"
                        try:
                            page.screenshot(path=screenshot_path, full_page=True)
                        except:
                            screenshot_path = None
                    
                    # Detect defects (sync version)
                    defects = detect_defects_sync(page, page_data, screenshot_path)
                    
                    # Store defects
                    if defects:
                        page_cap.metadata['defects'] = len(defects)
                        self.detected_defects.extend(defects)
                        logger.info(f"Detected {len(defects)} defects on {url}")
                except Exception as defect_error:
                    logger.warning(f"Error detecting defects on {url}: {defect_error}")
                
                # Store discovered page
                page_id = self._generate_page_id(url)
                self.discovered_pages[page_id] = page_cap
                self.visited_urls.add(url)
                
                # Extract links for further exploration (sync version)
                links = self._extract_links_sync(page)
                
                # Add new links to exploration queue
                for link_url in links:
                    if link_url not in self.visited_urls and depth < self.config.max_depth:
                        self.exploration_queue.append((link_url, depth + 1))
                
                logger.debug(f"Page {url}: {len(links)} links found, {len(self.exploration_queue)} in queue")
            except Exception as extract_error:
                logger.warning(f"Failed to extract capabilities from {url}: {extract_error}")
                # Still mark as visited to avoid infinite retries
                self.visited_urls.add(url)
            
        except Exception as e:
            logger.warning(f"Failed to explore page {url}: {e}", exc_info=True)
            # Mark as visited to avoid infinite retries
            self.visited_urls.add(url)
    
    def _extract_links_sync(self, page) -> List[str]:
        """Extract links from page using sync Playwright (Windows-compatible)"""
        links = []
        try:
            link_elements = page.query_selector_all('a[href]')
            for link in link_elements:
                href = link.get_attribute('href')
                if href:
                    # Resolve relative URLs
                    from urllib.parse import urljoin
                    full_url = urljoin(page.url, href)
                    # Check if URL should be explored (not excluded, in allowed domain)
                    if not self._should_exclude_url(full_url):
                        # Check if it's in allowed domains
                        parsed = urlparse(full_url)
                        if not self.config.allowed_domains or parsed.netloc in self.config.allowed_domains:
                            links.append(full_url)
        except Exception as e:
            logger.warning(f"Failed to extract links: {e}")
        return links
    
    async def _extract_links(self) -> List[str]:
        """Extract all links and return their URLs."""
        links = []
        elements = await self.page.query_selector_all('a[href]')
        
        for elem in elements:
            try:
                href = await elem.get_attribute('href')
                if href:
                    # Convert relative URLs to absolute
                    absolute_url = urljoin(self.page.url, href)
                    # Remove fragments
                    absolute_url = absolute_url.split('#')[0]
                    
                    # Check if URL is in allowed domains
                    parsed = urlparse(absolute_url)
                    if parsed.netloc in self.config.allowed_domains:
                        links.append(absolute_url)
            except:
                continue
        
        return list(set(links))  # Remove duplicates
    
    async def _extract_forms(self) -> List[Dict[str, Any]]:
        """Extract all forms and their fields."""
        forms = []
        form_elements = await self.page.query_selector_all('form')
        
        for form in form_elements:
            try:
                form_id = await form.get_attribute('id')
                form_action = await form.get_attribute('action')
                
                # Extract form fields
                fields = []
                inputs = await form.query_selector_all('input, select, textarea')
                
                for input_elem in inputs:
                    field_type = await input_elem.get_attribute('type') or 'text'
                    field_name = await input_elem.get_attribute('name') or ''
                    field_id = await input_elem.get_attribute('id') or ''
                    placeholder = await input_elem.get_attribute('placeholder') or ''
                    required = await input_elem.get_attribute('required') is not None
                    
                    # Get label
                    label_text = ''
                    if field_id:
                        label = await self.page.query_selector(f'label[for="{field_id}"]')
                        if label:
                            label_text = await label.text_content() or ''
                    
                    # Get options for select
                    options = []
                    if input_elem.tag_name == 'select':
                        option_elements = await input_elem.query_selector_all('option')
                        for opt in option_elements:
                            opt_text = await opt.text_content()
                            opt_value = await opt.get_attribute('value')
                            if opt_text:
                                options.append({'text': opt_text.strip(), 'value': opt_value or ''})
                    
                    fields.append({
                        'name': field_name,
                        'id': field_id,
                        'type': field_type,
                        'label': label_text.strip() if label_text else '',
                        'placeholder': placeholder,
                        'required': required,
                        'options': options
                    })
                
                forms.append({
                    'id': form_id or '',
                    'action': form_action or '',
                    'fields': fields
                })
            except Exception as e:
                logger.debug(f"Error extracting form: {e}")
                continue
        
        return forms
    
    async def _extract_tables(self) -> List[Dict[str, Any]]:
        """Extract table structures."""
        tables = []
        table_elements = await self.page.query_selector_all('table')
        
        for table in table_elements:
            try:
                # Extract headers
                headers = []
                header_rows = await table.query_selector_all('thead tr th, tr:first-child th, tr:first-child td')
                for header in header_rows:
                    text = await header.text_content()
                    if text:
                        headers.append(text.strip())
                
                # Extract actions (buttons/links in table rows)
                actions = []
                action_buttons = await table.query_selector_all('tbody button, tbody a')
                for btn in action_buttons:
                    text = await btn.text_content()
                    if text:
                        actions.append(text.strip())
                
                tables.append({
                    'headers': headers,
                    'actions': list(set(actions))  # Unique actions
                })
            except:
                continue
        
        return tables
    
    async def _extract_entities(self, headings: List[str], buttons: List[Dict], forms: List[Dict]) -> List[str]:
        """Infer entities from page content (heuristic-based)."""
        entities = []
        
        # Get current page URL for URL-based inference
        current_url = self.page.url if self.page else ''
        
        # Common entity patterns in headings
        entity_patterns = [
            r'(\w+)\s+List',
            r'(\w+)\s+Management',
            r'Create\s+(\w+)',
            r'Edit\s+(\w+)',
            r'(\w+)\s+Settings',
            r'(\w+)\s+Details',
            r'(\w+)\s+Profile',
        ]
        
        # Check headings
        for heading in headings:
            for pattern in entity_patterns:
                match = re.search(pattern, heading, re.IGNORECASE)
                if match:
                    entity = match.group(1).capitalize()
                    if entity not in entities:
                        entities.append(entity)
        
        # Infer entities from URL patterns (e.g., /shop/deals/electronics → Product, Deal)
        url_entity_patterns = [
            r'/shop/(\w+)',  # /shop/products, /shop/deals
            r'/products?/(\w+)',  # /product/electronics
            r'/items?/(\w+)',  # /item/123
            r'/orders?',  # /orders → Order
            r'/cart',  # /cart → Cart
            r'/account',  # /account → Account
            r'/users?',  # /users → User
            r'/customers?',  # /customers → Customer
        ]
        
        for pattern in url_entity_patterns:
            match = re.search(pattern, current_url, re.IGNORECASE)
            if match:
                if pattern.endswith('orders?') or pattern.endswith('cart') or pattern.endswith('account'):
                    entity = match.group(0).replace('/', '').capitalize()
                else:
                    entity = match.group(1).capitalize()
                if entity not in entities:
                    entities.append(entity)
        
        # Check forms (form action/ID often contains entity name)
        for form in forms:
            form_action = form.get('action', '')
            if form_action:
                # Extract entity from URL patterns like /users/create, /products/edit
                match = re.search(r'/(\w+)/(create|edit|new)', form_action, re.IGNORECASE)
                if match:
                    entity = match.group(1).capitalize()
                    if entity not in entities:
                        entities.append(entity)
        
        # Infer from button labels (e.g., "Add to Cart" → Cart, "Checkout" → Order)
        for button in buttons:
            button_text = button.get('text', '').lower()
            if 'cart' in button_text or 'add to cart' in button_text:
                if 'Cart' not in entities:
                    entities.append('Cart')
            if 'checkout' in button_text or 'order' in button_text:
                if 'Order' not in entities:
                    entities.append('Order')
            if 'product' in button_text:
                if 'Product' not in entities:
                    entities.append('Product')
        
        # If no entities found, infer from URL structure
        if not entities and current_url:
            # Common e-commerce entities
            if '/shop' in current_url or '/product' in current_url or '/item' in current_url:
                entities.append('Product')
            if '/cart' in current_url:
                entities.append('Cart')
            if '/order' in current_url:
                entities.append('Order')
            if '/account' in current_url or '/user' in current_url:
                entities.append('User')
            if '/deal' in current_url:
                entities.append('Deal')
        
        return entities
        
        return entities
    
    async def _extract_actions(self, buttons: List[Dict], links: List[str]) -> List[str]:
        """Extract action verbs from buttons and links."""
        actions = []
        
        # Common action verbs
        action_verbs = ['create', 'edit', 'delete', 'view', 'export', 'import', 'save', 'cancel', 'submit']
        
        for button in buttons:
            text = button.get('text', '').lower()
            for verb in action_verbs:
                if verb in text and verb.capitalize() not in actions:
                    actions.append(verb.capitalize())
        
        return actions
    
    def _should_exclude_url(self, url: str) -> bool:
        """Check if URL should be excluded from exploration."""
        # Check excluded paths
        for path in self.config.excluded_paths:
            if path in url:
                return True
        
        # Check excluded patterns
        for pattern in self.config.excluded_patterns:
            if re.search(pattern, url, re.IGNORECASE):
                return True
        
        return False
    
    def _generate_page_id(self, url: str) -> str:
        """Generate a unique page ID from URL."""
        parsed = urlparse(url)
        path = parsed.path.strip('/').replace('/', '_') or 'home'
        return f"{parsed.netloc.replace('.', '_')}_{path}"
    
    def _extract_url_pattern(self, url: str) -> Optional[str]:
        """Extract URL pattern (e.g., /users/:id/edit from /users/123/edit)."""
        parsed = urlparse(url)
        path = parsed.path
        
        # Replace numeric IDs with :id
        pattern = re.sub(r'/\d+', '/:id', path)
        # Replace UUIDs with :id
        pattern = re.sub(r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:id', pattern, re.IGNORECASE)
        
        return pattern if pattern != path else None
    
    def _build_capability_map(self) -> Dict[str, Any]:
        """Build the final capability map from discovered pages."""
        pages = []
        
        for page_id, page_cap in self.discovered_pages.items():
            pages.append({
                'id': page_id,
                'url': page_cap.url,
                'url_pattern': page_cap.url_pattern,
                'title': page_cap.title,
                'headings': page_cap.headings,
                'buttons': page_cap.buttons,
                'links': page_cap.links,
                'forms': page_cap.forms,
                'tables': page_cap.tables,
                'entities': page_cap.entities,
                'actions': page_cap.actions,
                'screenshots': page_cap.screenshots,
                'metadata': page_cap.metadata
            })
        
        # Convert defects to dict format
        defects_data = []
        for defect in self.detected_defects:
            from dataclasses import asdict
            try:
                defects_data.append(asdict(defect))
            except:
                # Fallback if asdict fails
                defects_data.append({
                    'defect_type': defect.defect_type,
                    'severity': defect.severity,
                    'title': defect.title,
                    'description': defect.description,
                    'page_url': defect.page_url,
                    'page_id': defect.page_id
                })
        
        return {
            'base_url': self.config.base_url,
            'exploration_date': datetime.utcnow().isoformat(),
            'total_pages': len(pages),
            'total_defects': len(self.detected_defects),
            'pages': pages,
            'defects': defects_data
        }

