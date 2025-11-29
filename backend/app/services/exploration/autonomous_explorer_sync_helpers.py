"""
Sync helper methods for autonomous explorer (Windows compatibility)
These methods mirror the async methods but use sync Playwright API
"""

import logging
from typing import Dict, List, Any, Optional
from playwright.sync_api import Page, BrowserContext

logger = logging.getLogger(__name__)


def perform_login_sync(page: Page, login_flow: Dict[str, Any], base_url: str) -> None:
    """Perform login flow using sync Playwright (Windows-compatible)"""
    login_url = login_flow.get('url', base_url)
    logger.info(f"Performing login at {login_url}")
    
    page.goto(login_url, wait_until='domcontentloaded', timeout=60000)
    
    # Fill username
    if login_flow.get('username_selector'):
        page.fill(login_flow['username_selector'], login_flow.get('username', ''), timeout=10000)
    
    # Fill password
    if login_flow.get('password_selector'):
        page.fill(login_flow['password_selector'], login_flow.get('password', ''), timeout=10000)
    
    # Submit
    if login_flow.get('submit_selector'):
        page.click(login_flow['submit_selector'], timeout=10000)
        page.wait_for_load_state('domcontentloaded', timeout=30000)
    
    logger.info("Login completed")


def extract_page_capabilities_sync(page: Page, url: str, config) -> Dict[str, Any]:
    """Extract page capabilities using sync Playwright (Windows-compatible)"""
    from datetime import datetime
    from urllib.parse import urlparse
    
    # Extract basic page info
    title = page.title()
    
    # Extract headings
    headings = []
    for level in range(1, 7):
        elements = page.query_selector_all(f'h{level}')
        for elem in elements:
            text = elem.text_content()
            if text and text.strip():
                headings.append(text.strip())
    
    # Extract buttons
    buttons = []
    button_selectors = ['button', '[role="button"]', 'input[type="button"]', 'input[type="submit"]']
    for selector in button_selectors:
        elements = page.query_selector_all(selector)
        for elem in elements:
            text = elem.text_content() or elem.get_attribute('aria-label') or elem.get_attribute('value')
            if text and text.strip():
                buttons.append({
                    "text": text.strip(),
                    "selector": selector,
                    "visible": elem.is_visible()
                })
    
    # Extract links
    links = []
    link_elements = page.query_selector_all('a[href]')
    for link in link_elements:
        href = link.get_attribute('href')
        text = link.text_content() or link.get_attribute('aria-label')
        if href and text and text.strip():
            links.append({
                "text": text.strip(),
                "href": href,
                "visible": link.is_visible()
            })
    
    # Extract forms
    forms = []
    form_elements = page.query_selector_all('form')
    for form_el in form_elements:
        form_data = {"fields": []}
        inputs = form_el.query_selector_all('input, textarea, select')
        for input_el in inputs:
            name = input_el.get_attribute('name') or input_el.get_attribute('id') or input_el.get_attribute('aria-label')
            input_type = input_el.get_attribute('type') or input_el.evaluate('el => el.tagName.toLowerCase()')
            placeholder = input_el.get_attribute('placeholder')
            if name and name.strip():
                form_data["fields"].append({
                    "name": name.strip(),
                    "type": input_type,
                    "placeholder": placeholder,
                    "required": input_el.get_attribute('required') is not None
                })
        if form_data["fields"]:
            forms.append(form_data)
    
    # Extract tables
    tables = []
    table_elements = page.query_selector_all('table')
    for table_el in table_elements:
        headers = [th.text_content().strip() for th in table_el.query_selector_all('th') if th.text_content()]
        if headers:
            tables.append({
                "headers": headers,
                "selector": "table"
            })
    
    # Generate page ID
    parsed = urlparse(url)
    page_id = f"{parsed.netloc}{parsed.path}".replace('/', '_').replace('.', '_')
    
    # Extract entities from page content
    entities = _extract_entities_sync(headings, buttons, forms, url)
    
    # Extract actions from buttons and links
    actions = _extract_actions_sync(buttons, links)
    
    return {
        "id": page_id,
        "url": url,
        "title": title,
        "headings": headings,
        "buttons": buttons,
        "links": links,
        "forms": forms,
        "tables": tables,
        "entities": entities,
        "actions": actions,
        "screenshots": []
    }


def _extract_entities_sync(headings: List[str], buttons: List[Dict], forms: List[Dict], url: str) -> List[str]:
    """Infer entities from page content (sync version)."""
    import re
    entities = []
    
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
        match = re.search(pattern, url, re.IGNORECASE)
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
    if not entities and url:
        # Common e-commerce entities
        if '/shop' in url or '/product' in url or '/item' in url:
            entities.append('Product')
        if '/cart' in url:
            entities.append('Cart')
        if '/order' in url:
            entities.append('Order')
        if '/account' in url or '/user' in url:
            entities.append('User')
        if '/deal' in url:
            entities.append('Deal')
    
    return entities


def _extract_actions_sync(buttons: List[Dict], links: List[Dict]) -> List[str]:
    """Extract action verbs from buttons and links (sync version)."""
    actions = []
    
    # Common action verbs
    action_verbs = ['create', 'edit', 'delete', 'view', 'export', 'import', 'save', 'cancel', 'submit', 'add', 'remove', 'checkout', 'search']
    
    for button in buttons:
        text = button.get('text', '').lower()
        for verb in action_verbs:
            if verb in text and verb.capitalize() not in actions:
                actions.append(verb.capitalize())
    
    # Also check links
    for link in links:
        text = link.get('text', '').lower()
        for verb in action_verbs:
            if verb in text and verb.capitalize() not in actions:
                actions.append(verb.capitalize())
    
    return actions

