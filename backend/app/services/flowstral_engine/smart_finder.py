"""
SMART ELEMENT FINDER
====================
ML-inspired element detection that scores ALL elements against intent.
This is what makes Testim/Mabl/Provar work - we're building our own.

Instead of: "try selector 1, try selector 2, fail"
We do: "find element with highest confidence score for this intent"
"""

import re
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from playwright.sync_api import Page, Locator, ElementHandle


@dataclass
class ElementIntent:
    """Describes WHAT we're looking for, not HOW to find it."""
    description: str  # Human description: "Save button", "Username field"
    
    # Text-based hints
    text: Optional[str] = None  # Exact or partial text
    label: Optional[str] = None  # Associated label
    placeholder: Optional[str] = None
    title: Optional[str] = None
    aria_label: Optional[str] = None
    
    # Role-based hints
    role: Optional[str] = None  # button, textbox, link, tab, etc.
    tag: Optional[str] = None  # input, button, a, etc.
    input_type: Optional[str] = None  # text, password, email, etc.
    
    # Context hints
    near_text: Optional[str] = None  # Text that should be nearby
    in_form: Optional[str] = None  # Form name/label
    in_modal: bool = False
    in_section: Optional[str] = None
    
    # Recorded hints (fallback, not primary)
    recorded_selector: Optional[str] = None
    recorded_xpath: Optional[str] = None
    
    # App-specific hints
    component_type: Optional[str] = None  # e.g., "lightning-input", "sf-app-launcher"
    data_attributes: Dict[str, str] = field(default_factory=dict)


@dataclass
class ScoredElement:
    """An element with its confidence score."""
    element: Locator
    score: float
    match_reasons: List[str]  # Why this element scored well
    

class SmartElementFinder:
    """
    The core of Flowstral Engine - finds elements by INTENT, not selectors.
    
    Scoring Weights (total = 100):
    - Text match: 30
    - Role/semantic match: 20
    - Label/accessibility: 20
    - Context/proximity: 15
    - Recorded selector hint: 10
    - Visibility/interactivity: 5
    """
    
    # Scoring weights - can be tuned per application
    WEIGHTS = {
        'text_exact': 30,
        'text_contains': 20,
        'role_match': 20,
        'label_match': 20,
        'aria_match': 15,
        'placeholder_match': 15,
        'title_match': 15,
        'near_text': 15,
        'in_context': 10,
        'recorded_selector': 10,
        'visible': 5,
        'enabled': 5,
    }
    
    # Minimum score to consider a match
    CONFIDENCE_THRESHOLD = 25
    
    def __init__(self, page: Page, app_plugin=None):
        self.page = page
        self.app_plugin = app_plugin  # App-specific intelligence
        
    def find(self, intent: ElementIntent, timeout: int = 10000) -> Locator:
        """
        Find element matching the intent with highest confidence.
        
        Args:
            intent: What we're looking for
            timeout: Max time to wait for element
            
        Returns:
            Locator for the best matching element
            
        Raises:
            ElementNotFoundError: If no element meets confidence threshold
        """
        # Strategy 1: Try app-specific shortcuts first (fastest)
        if self.app_plugin:
            result = self.app_plugin.find_component(intent)
            if result:
                return result
        
        # Strategy 2: Use Playwright's semantic locators (fast & reliable)
        semantic_result = self._try_semantic_locators(intent)
        if semantic_result:
            return semantic_result
        
        # Strategy 3: Full element scoring (comprehensive)
        scored_elements = self._score_all_elements(intent)
        
        if scored_elements and scored_elements[0].score >= self.CONFIDENCE_THRESHOLD:
            best = scored_elements[0]
            print(f"   [FOUND] Score: {best.score:.1f} | Reasons: {', '.join(best.match_reasons[:3])}")
            return best.element
        
        # Strategy 4: Retry with relaxed criteria
        scored_elements = self._score_all_elements(intent, relaxed=True)
        
        if scored_elements and scored_elements[0].score >= self.CONFIDENCE_THRESHOLD * 0.7:
            best = scored_elements[0]
            print(f"   [FOUND-RELAXED] Score: {best.score:.1f} | Reasons: {', '.join(best.match_reasons[:3])}")
            return best.element
        
        # No match found - provide helpful error
        self._raise_not_found_error(intent, scored_elements[:5] if scored_elements else [])
    
    def _try_semantic_locators(self, intent: ElementIntent) -> Optional[Locator]:
        """Try Playwright's built-in semantic locators first - they're fast and reliable."""
        locators_to_try = []
        
        # Role + name is most reliable
        if intent.role and (intent.text or intent.label or intent.aria_label):
            name = intent.text or intent.label or intent.aria_label
            locators_to_try.append(
                (f"role={intent.role}[name='{name}']", 
                 self.page.get_by_role(intent.role, name=name))
            )
            # Also try exact=False
            locators_to_try.append(
                (f"role={intent.role}[name*='{name}']",
                 self.page.get_by_role(intent.role, name=re.compile(name, re.IGNORECASE)))
            )
        
        # Label-based (for form inputs)
        if intent.label:
            locators_to_try.append(
                (f"label='{intent.label}'",
                 self.page.get_by_label(intent.label))
            )
            locators_to_try.append(
                (f"label*='{intent.label}'",
                 self.page.get_by_label(re.compile(intent.label, re.IGNORECASE)))
            )
        
        # Placeholder
        if intent.placeholder:
            locators_to_try.append(
                (f"placeholder='{intent.placeholder}'",
                 self.page.get_by_placeholder(intent.placeholder))
            )
            locators_to_try.append(
                (f"placeholder*='{intent.placeholder}'",
                 self.page.get_by_placeholder(re.compile(intent.placeholder, re.IGNORECASE)))
            )
        
        # Text-based
        if intent.text:
            locators_to_try.append(
                (f"text='{intent.text}' (exact)",
                 self.page.get_by_text(intent.text, exact=True))
            )
            locators_to_try.append(
                (f"text*='{intent.text}'",
                 self.page.get_by_text(intent.text))
            )
        
        # Title
        if intent.title:
            locators_to_try.append(
                (f"title='{intent.title}'",
                 self.page.get_by_title(intent.title))
            )
        
        # Try each locator
        for desc, locator in locators_to_try:
            try:
                count = locator.count()
                if count == 1:
                    if locator.is_visible(timeout=1000):
                        print(f"   [SEMANTIC] Found via {desc}")
                        return locator
                elif count > 1:
                    # Multiple matches - try to get visible one
                    visible_locator = locator.locator("visible=true").first
                    if visible_locator.count() > 0:
                        print(f"   [SEMANTIC] Found via {desc} (first visible of {count})")
                        return visible_locator
            except:
                continue
        
        return None
    
    def _score_all_elements(self, intent: ElementIntent, relaxed: bool = False) -> List[ScoredElement]:
        """Score all interactive elements against the intent."""
        scored = []
        
        # Get all potentially interactive elements
        selector = self._build_candidate_selector(intent)
        candidates = self.page.locator(selector)
        
        count = candidates.count()
        if count == 0:
            return []
        
        # Limit candidates for performance
        max_candidates = 100
        if count > max_candidates:
            count = max_candidates
        
        for i in range(count):
            try:
                element = candidates.nth(i)
                score, reasons = self._score_element(element, intent, relaxed)
                
                if score > 0:
                    scored.append(ScoredElement(
                        element=element,
                        score=score,
                        match_reasons=reasons
                    ))
            except:
                continue
        
        # Sort by score descending
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored
    
    def _build_candidate_selector(self, intent: ElementIntent) -> str:
        """Build a selector to get candidate elements."""
        # Start with interactive elements
        if intent.role == "button" or intent.tag == "button":
            return "button, [role='button'], input[type='submit'], input[type='button'], a.btn, a.button, .slds-button"
        elif intent.role == "textbox" or intent.tag == "input":
            return "input, textarea, [role='textbox'], [contenteditable='true']"
        elif intent.role == "link" or intent.tag == "a":
            return "a, [role='link']"
        elif intent.role == "tab":
            return "[role='tab'], .nav-link, .tab, a[data-tab-value]"
        elif intent.role == "combobox" or intent.role == "listbox":
            return "[role='combobox'], [role='listbox'], select, .slds-combobox"
        elif intent.role == "checkbox":
            return "input[type='checkbox'], [role='checkbox']"
        else:
            # Generic interactive elements
            return "button, a, input, select, textarea, [role='button'], [role='link'], [role='tab'], [tabindex], [onclick]"
    
    def _score_element(self, element: Locator, intent: ElementIntent, relaxed: bool = False) -> Tuple[float, List[str]]:
        """Score a single element against the intent."""
        score = 0.0
        reasons = []
        
        try:
            # Get element attributes
            text = (element.text_content() or "").strip()
            attrs = self._get_element_attributes(element)
            
            # === TEXT MATCHING (30 points max) ===
            if intent.text:
                intent_text_lower = intent.text.lower()
                text_lower = text.lower()
                
                if text_lower == intent_text_lower:
                    score += self.WEIGHTS['text_exact']
                    reasons.append(f"text='{intent.text}'")
                elif intent_text_lower in text_lower:
                    score += self.WEIGHTS['text_contains']
                    reasons.append(f"text contains '{intent.text}'")
                elif relaxed and self._fuzzy_match(intent_text_lower, text_lower):
                    score += self.WEIGHTS['text_contains'] * 0.5
                    reasons.append(f"text~'{intent.text}'")
            
            # === ROLE MATCHING (20 points) ===
            if intent.role:
                element_role = attrs.get('role', '').lower()
                tag = attrs.get('tag', '').lower()
                
                # Map tags to implicit roles
                implicit_roles = {
                    'button': 'button',
                    'a': 'link',
                    'input': 'textbox',
                    'select': 'combobox',
                    'textarea': 'textbox',
                }
                
                if element_role == intent.role or implicit_roles.get(tag) == intent.role:
                    score += self.WEIGHTS['role_match']
                    reasons.append(f"role={intent.role}")
            
            # === LABEL MATCHING (20 points) ===
            if intent.label:
                label_lower = intent.label.lower()
                
                # Check aria-label
                aria_label = attrs.get('aria-label', '').lower()
                if label_lower in aria_label or aria_label in label_lower:
                    score += self.WEIGHTS['label_match']
                    reasons.append(f"aria-label matches")
                
                # Check associated label element (via id)
                element_id = attrs.get('id', '')
                if element_id:
                    try:
                        label_el = self.page.locator(f"label[for='{element_id}']")
                        if label_el.count() > 0:
                            label_text = (label_el.text_content() or "").lower()
                            if label_lower in label_text:
                                score += self.WEIGHTS['label_match']
                                reasons.append(f"label='{intent.label}'")
                    except:
                        pass
            
            # === ARIA MATCHING (15 points) ===
            if intent.aria_label:
                aria = attrs.get('aria-label', '').lower()
                if intent.aria_label.lower() in aria:
                    score += self.WEIGHTS['aria_match']
                    reasons.append(f"aria-label='{intent.aria_label}'")
            
            # === PLACEHOLDER MATCHING (15 points) ===
            if intent.placeholder:
                placeholder = attrs.get('placeholder', '').lower()
                if intent.placeholder.lower() in placeholder:
                    score += self.WEIGHTS['placeholder_match']
                    reasons.append(f"placeholder='{intent.placeholder}'")
            
            # === TITLE MATCHING (15 points) ===
            if intent.title:
                title = attrs.get('title', '').lower()
                if intent.title.lower() in title:
                    score += self.WEIGHTS['title_match']
                    reasons.append(f"title='{intent.title}'")
            
            # === VISIBILITY (5 points) ===
            try:
                if element.is_visible(timeout=500):
                    score += self.WEIGHTS['visible']
                    reasons.append("visible")
            except:
                pass
            
            # === ENABLED (5 points) ===
            try:
                if element.is_enabled(timeout=500):
                    score += self.WEIGHTS['enabled']
                    reasons.append("enabled")
            except:
                pass
            
        except Exception as e:
            pass
        
        return score, reasons
    
    def _get_element_attributes(self, element: Locator) -> Dict[str, str]:
        """Get relevant attributes from an element."""
        attrs = {}
        
        try:
            attrs['tag'] = element.evaluate("el => el.tagName.toLowerCase()")
            attrs['id'] = element.get_attribute('id') or ""
            attrs['class'] = element.get_attribute('class') or ""
            attrs['name'] = element.get_attribute('name') or ""
            attrs['type'] = element.get_attribute('type') or ""
            attrs['role'] = element.get_attribute('role') or ""
            attrs['aria-label'] = element.get_attribute('aria-label') or ""
            attrs['placeholder'] = element.get_attribute('placeholder') or ""
            attrs['title'] = element.get_attribute('title') or ""
            attrs['data-label'] = element.get_attribute('data-label') or ""
            attrs['data-value'] = element.get_attribute('data-value') or ""
        except:
            pass
        
        return attrs
    
    def _fuzzy_match(self, s1: str, s2: str, threshold: float = 0.7) -> bool:
        """Simple fuzzy string matching."""
        if not s1 or not s2:
            return False
        
        # Simple containment check
        if s1 in s2 or s2 in s1:
            return True
        
        # Word overlap
        words1 = set(s1.split())
        words2 = set(s2.split())
        
        if not words1 or not words2:
            return False
        
        overlap = len(words1 & words2) / max(len(words1), len(words2))
        return overlap >= threshold
    
    def _raise_not_found_error(self, intent: ElementIntent, top_candidates: List[ScoredElement]):
        """Raise a helpful error with debugging info."""
        msg = f"\n{'='*60}\n"
        msg += f"ELEMENT NOT FOUND: {intent.description}\n"
        msg += f"{'='*60}\n\n"
        
        msg += "Intent:\n"
        for key, value in intent.__dict__.items():
            if value and key != 'description':
                msg += f"  - {key}: {value}\n"
        
        if top_candidates:
            msg += f"\nTop {len(top_candidates)} candidates (didn't meet confidence threshold {self.CONFIDENCE_THRESHOLD}):\n"
            for i, candidate in enumerate(top_candidates):
                try:
                    text = (candidate.element.text_content() or "")[:50]
                    msg += f"\n  {i+1}. Score: {candidate.score:.1f}\n"
                    msg += f"     Text: '{text}'\n"
                    msg += f"     Reasons: {', '.join(candidate.match_reasons)}\n"
                except:
                    pass
        else:
            msg += "\nNo candidate elements found at all.\n"
        
        msg += f"\n{'='*60}\n"
        
        raise Exception(msg)

