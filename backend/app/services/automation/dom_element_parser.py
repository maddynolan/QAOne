"""
DOM Element Parser — Parse pasted HTML into element dict for selector generation.

When AI auto-fix fails, users can paste element HTML from DevTools
(right-click → Copy → Copy outerHTML). This parser extracts attributes
from the raw HTML and produces the element dict format consumed by
EnhancedSelectorEngine.generate_robust_selectors().

Handles:
  - Single elements: <button class="btn" data-testid="submit">Click</button>
  - Nested HTML: extracts combined text content from children
  - Partial/malformed HTML: best-effort parsing, never throws
  - All relevant attributes: id, name, type, class, data-*, aria-*, role, href, etc.
"""

import logging
import re
from html.parser import HTMLParser
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class _ElementExtractor(HTMLParser):
    """
    HTMLParser subclass that extracts attributes from the outermost element
    and collects all descendant text content.
    """

    def __init__(self):
        super().__init__()
        self.depth = 0
        self.root_tag: Optional[str] = None
        self.root_attrs: Dict[str, str] = {}
        self.text_parts: List[str] = []
        self._parsed_root = False

    def handle_starttag(self, tag: str, attrs: list):
        self.depth += 1
        if not self._parsed_root:
            self.root_tag = tag.lower()
            self.root_attrs = {k.lower(): (v or "") for k, v in attrs}
            self._parsed_root = True

    def handle_endtag(self, tag: str):
        self.depth = max(0, self.depth - 1)

    def handle_data(self, data: str):
        stripped = data.strip()
        if stripped:
            self.text_parts.append(stripped)

    def handle_startendtag(self, tag: str, attrs: list):
        # Self-closing tags like <input />
        if not self._parsed_root:
            self.root_tag = tag.lower()
            self.root_attrs = {k.lower(): (v or "") for k, v in attrs}
            self._parsed_root = True


def parse_html_to_element(html: str) -> Dict[str, Any]:
    """
    Parse an HTML string (e.g. copied outerHTML from DevTools) into the element
    dict format expected by EnhancedSelectorEngine.generate_robust_selectors().

    Args:
        html: Raw HTML string, e.g. '<button class="btn-primary" data-testid="submit">Submit</button>'

    Returns:
        Element dict with keys: tag_name, id, name, type, text_content, class_name,
        data_testid, data_cy, data_test, href, placeholder, title, value,
        accessibility: {aria_label, ariaLabel, role, aria_labelledby, ariaLabelledBy}
        Plus all raw data-* attributes as data_<name> keys.
    """
    html = (html or "").strip()
    if not html:
        return _empty_element()

    try:
        parser = _ElementExtractor()
        parser.feed(html)

        if not parser.root_tag:
            return _empty_element()

        attrs = parser.root_attrs
        text_content = " ".join(parser.text_parts)

        # Build accessibility sub-dict
        aria_label = attrs.get("aria-label", "")
        aria_labelledby = attrs.get("aria-labelledby", "")
        role = attrs.get("role", "")

        accessibility = {}
        if aria_label:
            accessibility["aria_label"] = aria_label
            accessibility["ariaLabel"] = aria_label
        if aria_labelledby:
            accessibility["aria_labelledby"] = aria_labelledby
            accessibility["ariaLabelledBy"] = aria_labelledby
        if role:
            accessibility["role"] = role

        # Collect all aria-* attributes
        for key, val in attrs.items():
            if key.startswith("aria-") and key not in ("aria-label", "aria-labelledby"):
                safe_key = key.replace("-", "_")
                accessibility[safe_key] = val

        # Build element dict
        element: Dict[str, Any] = {
            "tag_name": parser.root_tag,
            "id": attrs.get("id", ""),
            "name": attrs.get("name", ""),
            "type": attrs.get("type", ""),
            "text_content": text_content,
            "class_name": attrs.get("class", ""),
            "href": attrs.get("href", ""),
            "placeholder": attrs.get("placeholder", ""),
            "title": attrs.get("title", ""),
            "value": attrs.get("value", ""),
            "accessibility": accessibility,
        }

        # Extract data-* attributes
        for key, val in attrs.items():
            if key.startswith("data-"):
                # Convert data-testid -> data_testid
                safe_key = key.replace("-", "_")
                element[safe_key] = val

        # Ensure common data attributes are at top level for EnhancedSelectorEngine
        if "data_testid" not in element:
            element["data_testid"] = ""
        if "data_cy" not in element:
            element["data_cy"] = ""
        if "data_test" not in element:
            element["data_test"] = ""

        return element

    except Exception as e:
        logger.warning(f"[DOMElementParser] Failed to parse HTML: {e}")
        return _empty_element()


def parse_and_generate_selectors(html: str, html_context: Optional[str] = None) -> Dict[str, Any]:
    """
    Parse HTML and generate robust selectors in one call.

    Args:
        html: Raw HTML string from DevTools outerHTML copy
        html_context: Optional surrounding HTML for context-aware selectors

    Returns:
        Result from EnhancedSelectorEngine.generate_robust_selectors()
        with keys: primary, playwright_primary, fallbacks, all_candidates, etc.
    """
    element = parse_html_to_element(html)

    if not element.get("tag_name"):
        return {
            "primary": "",
            "playwright_primary": "",
            "fallbacks": [],
            "playwright_fallbacks": [],
            "all_candidates": [],
            "stability_score": 0.0,
            "recommended_strategy": "none",
            "error": "Could not parse HTML — no valid element found",
        }

    try:
        from app.services.automation.enhanced_selector_engine import EnhancedSelectorEngine
        engine = EnhancedSelectorEngine()
        result = engine.generate_robust_selectors(
            element=element,
            html_context=html_context,
        )
        return result
    except Exception as e:
        logger.error(f"[DOMElementParser] Selector generation failed: {e}")
        return {
            "primary": "",
            "playwright_primary": "",
            "fallbacks": [],
            "playwright_fallbacks": [],
            "all_candidates": [],
            "stability_score": 0.0,
            "recommended_strategy": "none",
            "error": f"Selector generation failed: {str(e)}",
        }


def validate_selector(selector_type: str, selector_value: str) -> Dict[str, Any]:
    """
    Validate a user-entered selector and format it as a Playwright locator.

    Args:
        selector_type: "css" | "xpath" | "text"
        selector_value: The selector string entered by the user

    Returns:
        {
            "valid": True/False,
            "selector": formatted selector,
            "playwright_locator": formatted Playwright locator string,
            "strategy": selector_type,
            "confidence": float,
            "message": validation message
        }
    """
    selector_value = (selector_value or "").strip()
    if not selector_value:
        return {
            "valid": False,
            "selector": "",
            "playwright_locator": "",
            "strategy": selector_type,
            "confidence": 0.0,
            "message": "Selector is empty",
        }

    selector_type = (selector_type or "css").lower()

    if selector_type == "xpath":
        # Basic XPath validation — must start with / or //
        if not selector_value.startswith("/") and not selector_value.startswith("("):
            return {
                "valid": False,
                "selector": selector_value,
                "playwright_locator": "",
                "strategy": "xpath",
                "confidence": 0.0,
                "message": "XPath must start with / or //",
            }
        return {
            "valid": True,
            "selector": selector_value,
            "playwright_locator": f"page.locator('xpath={selector_value}')",
            "strategy": "xpath",
            "confidence": 0.85,
            "message": "Valid XPath selector",
        }

    elif selector_type == "text":
        # Text selector — use Playwright's getByText
        escaped = selector_value.replace("'", "\\'")
        return {
            "valid": True,
            "selector": f"text={selector_value}",
            "playwright_locator": f"page.getByText('{escaped}')",
            "strategy": "text_content",
            "confidence": 0.70,
            "message": "Text content selector",
        }

    else:
        # CSS selector validation — basic check
        try:
            # Check for obviously invalid CSS
            if selector_value.count("(") != selector_value.count(")"):
                return {
                    "valid": False,
                    "selector": selector_value,
                    "playwright_locator": "",
                    "strategy": "css",
                    "confidence": 0.0,
                    "message": "Unbalanced parentheses in CSS selector",
                }
            if selector_value.count("[") != selector_value.count("]"):
                return {
                    "valid": False,
                    "selector": selector_value,
                    "playwright_locator": "",
                    "strategy": "css",
                    "confidence": 0.0,
                    "message": "Unbalanced brackets in CSS selector",
                }

            escaped = selector_value.replace("'", "\\'")
            return {
                "valid": True,
                "selector": selector_value,
                "playwright_locator": f"page.locator('{escaped}')",
                "strategy": "css",
                "confidence": 0.80,
                "message": "Valid CSS selector",
            }
        except Exception:
            return {
                "valid": False,
                "selector": selector_value,
                "playwright_locator": "",
                "strategy": "css",
                "confidence": 0.0,
                "message": "Invalid CSS selector syntax",
            }


def _empty_element() -> Dict[str, Any]:
    """Return an empty element dict."""
    return {
        "tag_name": "",
        "id": "",
        "name": "",
        "type": "",
        "text_content": "",
        "class_name": "",
        "data_testid": "",
        "href": "",
        "placeholder": "",
        "title": "",
        "value": "",
        "accessibility": {},
    }
