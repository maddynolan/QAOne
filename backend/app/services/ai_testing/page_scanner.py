"""
Page Scanner - The Foundation of Robust AI Testing

This is the KEY insight that makes us better than everyone:
- TestRigor: Scans elements but generates THEIR own locators
- Blinq.io: Records interactions but no AI generation
- Us: Scan real DOM → Extract SAME selectors as our Recorder → Run through SAME SmartFinder

The scanner runs IN the browser and extracts everything SmartSelector extracts during recording.
Result: AI-generated tests are IDENTICAL in quality to human-recorded tests.

Flow:
1. Inject scanner JS into page
2. Scanner finds ALL interactive elements
3. For each element: extract text, id, name, role, ariaLabel, testId, placeholder, CSS, etc.
4. Associate labels with inputs (like a human: "Username" label → nearby input)
5. Return structured map that AI can match against

@version 1.0.0
"""

import logging
import json
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


# This JavaScript runs IN the browser page to scan all interactive elements
# It mirrors what SmartSelector/recorder-engine.js does during recording
PAGE_SCANNER_JS = """
() => {
    const results = {
        url: window.location.href,
        title: document.title,
        elements: [],
        pageInfo: {
            forms: document.querySelectorAll('form').length,
            inputs: document.querySelectorAll('input:not([type="hidden"])').length,
            buttons: document.querySelectorAll('button, input[type="submit"], [role="button"]').length,
            links: document.querySelectorAll('a[href]').length,
        }
    };

    // Dynamic ID patterns (same as SmartSelector)
    const dynamicIdPatterns = [
        /^[a-f0-9]{8,}/,
        /^\\d{6,}/,
        /^:r[a-z0-9]+:/,
        /^ember\\d+/,
        /^ng-/,
        /^vue-/,
        /^aura_/,
        /^lwc-/,
        /^react-/,
        /^\\$\\$/,
    ];

    function isDynamicId(id) {
        if (!id) return true;
        return dynamicIdPatterns.some(p => p.test(id));
    }

    // Generate confidence score (matching SmartSelector priority)
    function getConfidence(el, selectorType) {
        const scores = {
            'testId': 100, 'dataTest': 95, 'dataCy': 95, 'dataQa': 90,
            'ariaLabel': 85, 'role+text': 75, 'placeholder': 70,
            'name': 65, 'id': 60, 'text': 55, 'css': 50, 'xpath': 20
        };
        return scores[selectorType] || 30;
    }

    // Find associated label for an input
    function findLabel(el) {
        // 1. Explicit label via for attribute
        if (el.id) {
            const label = document.querySelector('label[for="' + el.id + '"]');
            if (label) return label.textContent.trim();
        }
        // 2. Parent label
        const parentLabel = el.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        // 3. Preceding label sibling
        const prev = el.previousElementSibling;
        if (prev && prev.tagName === 'LABEL') return prev.textContent.trim();
        // 4. Nearby text (within same container)
        const parent = el.parentElement;
        if (parent) {
            const texts = parent.querySelectorAll('label, .label, [class*="label"], [class*="Label"]');
            for (const t of texts) {
                if (t.textContent.trim()) return t.textContent.trim();
            }
        }
        // 5. aria-labelledby
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
            const ref = document.getElementById(labelledBy);
            if (ref) return ref.textContent.trim();
        }
        return '';
    }

    // Generate all selector strategies for an element (like SmartSelector)
    function generateSelectors(el, index) {
        const selectors = [];
        const tag = el.tagName.toLowerCase();
        
        // data-testid (highest priority)
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-test') || el.getAttribute('data-cy') || el.getAttribute('data-qa');
        if (testId) {
            selectors.push({ selector: '[data-testid="' + testId + '"]', type: 'testId', confidence: 100 });
        }

        // aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
            selectors.push({ selector: '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]', type: 'ariaLabel', confidence: 85 });
        }

        // role + text (Playwright style)
        const role = el.getAttribute('role') || (tag === 'button' ? 'button' : tag === 'a' ? 'link' : tag === 'input' ? (el.type || 'textbox') : '');
        const text = el.textContent ? el.textContent.trim().substring(0, 80) : '';
        if (role && text) {
            selectors.push({ selector: 'role=' + role + '[name="' + text.replace(/"/g, '\\\\"') + '"]', type: 'role+text', confidence: 75, playwrightRole: role, playwrightName: text });
        }

        // placeholder
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) {
            selectors.push({ selector: '[placeholder="' + placeholder.replace(/"/g, '\\\\"') + '"]', type: 'placeholder', confidence: 70 });
        }

        // name
        const name = el.getAttribute('name');
        if (name) {
            selectors.push({ selector: tag + '[name="' + name + '"]', type: 'name', confidence: 65 });
        }

        // id (if not dynamic)
        if (el.id && !isDynamicId(el.id)) {
            selectors.push({ selector: '#' + CSS.escape(el.id), type: 'id', confidence: 60 });
        }

        // text content (for buttons/links)
        if (text && (tag === 'button' || tag === 'a' || role === 'button' || role === 'link')) {
            selectors.push({ selector: tag + ':has-text("' + text.substring(0, 50).replace(/"/g, '\\\\"') + '")', type: 'text', confidence: 55 });
        }

        // title
        const title = el.getAttribute('title');
        if (title) {
            selectors.push({ selector: '[title="' + title.replace(/"/g, '\\\\"') + '"]', type: 'title', confidence: 55 });
        }

        // type (for inputs)
        if (tag === 'input' && el.type) {
            selectors.push({ selector: 'input[type="' + el.type + '"]', type: 'inputType', confidence: 40 });
        }

        // Salesforce-specific
        const auraClass = el.getAttribute('data-aura-class');
        if (auraClass) {
            selectors.push({ selector: '[data-aura-class="' + auraClass + '"]', type: 'sf-aura', confidence: 70 });
        }
        const componentId = el.getAttribute('data-component-id');
        if (componentId) {
            selectors.push({ selector: '[data-component-id="' + componentId + '"]', type: 'sf-component', confidence: 65 });
        }
        const targetSelection = el.getAttribute('data-target-selection-name');
        if (targetSelection) {
            selectors.push({ selector: '[data-target-selection-name="' + targetSelection + '"]', type: 'sf-target', confidence: 75 });
        }

        return selectors;
    }

    // Scan all interactive elements
    const interactiveSelectors = [
        'input:not([type="hidden"])',
        'textarea',
        'select',
        'button',
        'a[href]',
        '[role="button"]',
        '[role="link"]',
        '[role="textbox"]',
        '[role="combobox"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="tab"]',
        '[role="menuitem"]',
        '[role="searchbox"]',
        'input[type="submit"]',
        '[contenteditable="true"]',
        '[onclick]',
        '[tabindex]:not([tabindex="-1"])',
    ];

    const seen = new Set();
    const allElements = [];

    // Deep query that also searches inside shadow DOMs (critical for Salesforce, LWC, etc.)
    function querySelectorAllDeep(root, selector) {
        const results = [];
        try {
            const els = root.querySelectorAll(selector);
            for (const el of els) results.push(el);
        } catch (e) {}
        // Traverse shadow roots
        try {
            const allNodes = root.querySelectorAll('*');
            for (const node of allNodes) {
                if (node.shadowRoot) {
                    try {
                        const shadowEls = node.shadowRoot.querySelectorAll(selector);
                        for (const el of shadowEls) results.push(el);
                        // Recurse into nested shadow roots
                        const deepResults = querySelectorAllDeep(node.shadowRoot, selector);
                        for (const el of deepResults) results.push(el);
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return results;
    }

    for (const selector of interactiveSelectors) {
        try {
            const elements = querySelectorAllDeep(document, selector);
            for (const el of elements) {
                // Skip hidden, duplicate, or tiny elements
                if (seen.has(el)) continue;
                seen.add(el);

                const rect = el.getBoundingClientRect();
                if (rect.width < 5 || rect.height < 5) continue;
                if (rect.top < -100 || rect.left < -100) continue;

                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

                allElements.push(el);
            }
        } catch (e) {}
    }

    // Process each element
    allElements.forEach((el, index) => {
        const tag = el.tagName.toLowerCase();
        const rect = el.getBoundingClientRect();
        const selectors = generateSelectors(el, index);
        const label = findLabel(el);

        const type = el.getAttribute('type') || '';
        const role = el.getAttribute('role') || '';
        const text = (el.textContent || '').trim().substring(0, 100);
        const placeholder = el.getAttribute('placeholder') || '';
        const name = el.getAttribute('name') || '';
        const id = el.id || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '';
        const value = el.value || '';

        // Classify what this element IS (for AI matching)
        let elementType = 'unknown';
        if (tag === 'input' || tag === 'textarea' || role === 'textbox' || role === 'searchbox') {
            if (type === 'password') elementType = 'password_field';
            else if (type === 'email') elementType = 'email_field';
            else if (type === 'search' || role === 'searchbox') elementType = 'search_field';
            else if (type === 'checkbox' || role === 'checkbox') elementType = 'checkbox';
            else if (type === 'radio' || role === 'radio') elementType = 'radio';
            else elementType = 'text_field';
        } else if (tag === 'button' || role === 'button' || type === 'submit') {
            elementType = 'button';
        } else if (tag === 'a' || role === 'link') {
            elementType = 'link';
        } else if (tag === 'select' || role === 'combobox') {
            elementType = 'dropdown';
        } else if (role === 'tab') {
            elementType = 'tab';
        } else if (role === 'menuitem') {
            elementType = 'menuitem';
        }

        // Build human-readable description (what a human would call this)
        let humanDescription = '';
        if (label) humanDescription = label;
        else if (ariaLabel) humanDescription = ariaLabel;
        else if (placeholder) humanDescription = placeholder;
        else if (text && text.length < 50) humanDescription = text;
        else if (name) humanDescription = name;
        else if (id && !isDynamicId(id)) humanDescription = id;
        else humanDescription = elementType + '_' + index;

        results.elements.push({
            index: index,
            tag: tag,
            type: type,
            role: role,
            elementType: elementType,
            humanDescription: humanDescription,
            label: label,
            text: text.substring(0, 100),
            placeholder: placeholder,
            name: name,
            id: id,
            ariaLabel: ariaLabel,
            testId: testId,
            value: value,
            href: el.getAttribute('href') || '',
            title: el.getAttribute('title') || '',
            className: el.className ? (typeof el.className === 'string' ? el.className.substring(0, 200) : '') : '',
            selectors: selectors,
            bestSelector: selectors.length > 0 ? selectors[0].selector : '',
            confidence: selectors.length > 0 ? selectors[0].confidence : 0,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            visible: true,
        });
    });

    // Sort by visual position (top-to-bottom, left-to-right)
    results.elements.sort((a, b) => {
        if (Math.abs(a.rect.y - b.rect.y) > 20) return a.rect.y - b.rect.y;
        return a.rect.x - b.rect.x;
    });

    // Re-index after sort
    results.elements.forEach((el, i) => el.index = i);

    return results;
}
"""


def get_scanner_js() -> str:
    """Get the page scanner JavaScript"""
    return PAGE_SCANNER_JS


def match_element(scanned_elements: List[Dict], intent: str, action: str = "click") -> Optional[Dict]:
    """
    Match user intent to a scanned element - like TestRigor's human emulator.
    
    This is pure pattern matching - NO AI API calls needed.
    
    Args:
        scanned_elements: List of elements from page scanner
        intent: What the user wants (e.g., "Username field", "Log In button")
        action: What they want to do (click, fill, assert)
    
    Returns:
        Best matching element or None
    """
    intent_lower = intent.lower().strip()
    
    # Score each element against the intent
    scored = []
    
    for el in scanned_elements:
        score = 0
        
        # Exact matches (highest)
        if el.get('humanDescription', '').lower() == intent_lower:
            score += 100
        if el.get('label', '').lower() == intent_lower:
            score += 100
        if el.get('ariaLabel', '').lower() == intent_lower:
            score += 95
        if el.get('placeholder', '').lower() == intent_lower:
            score += 90
        if el.get('name', '').lower() == intent_lower:
            score += 80
        if el.get('text', '').lower().strip() == intent_lower:
            score += 85
        
        # Partial matches
        for field in ['humanDescription', 'label', 'ariaLabel', 'placeholder', 'name', 'text', 'title', 'id']:
            field_val = el.get(field, '').lower()
            if not field_val:
                continue
            
            # Intent words in field
            intent_words = [w for w in intent_lower.split() if len(w) > 2 and w not in ('the', 'field', 'input', 'button', 'link', 'box', 'text', 'area')]
            for word in intent_words:
                if word in field_val:
                    score += 30
        
        # Element type matching
        el_type = el.get('elementType', '')
        
        # If intent mentions "button" and element is button
        if 'button' in intent_lower and el_type == 'button':
            score += 20
        if ('login' in intent_lower or 'log in' in intent_lower or 'sign in' in intent_lower) and el_type == 'button':
            if 'log' in el.get('text', '').lower() or 'sign' in el.get('text', '').lower():
                score += 50
        
        # If action is "fill" and element is a field
        if action == 'fill' and el_type in ('text_field', 'email_field', 'password_field', 'search_field'):
            score += 15
        
        # Username/password special matching
        if 'username' in intent_lower or 'user name' in intent_lower or 'email' in intent_lower:
            if el_type in ('text_field', 'email_field'):
                score += 25
            if el.get('name', '').lower() in ('username', 'user', 'email', 'login'):
                score += 40
            if el.get('id', '').lower() in ('username', 'user', 'email', 'login'):
                score += 40
            if 'user' in el.get('placeholder', '').lower() or 'email' in el.get('placeholder', '').lower():
                score += 35
        
        if 'password' in intent_lower:
            if el_type == 'password_field':
                score += 60  # Strong match - password fields are unique
            if el.get('name', '').lower() in ('password', 'pw', 'passwd'):
                score += 40
        
        if 'search' in intent_lower:
            if el_type == 'search_field':
                score += 50
            if 'search' in el.get('placeholder', '').lower():
                score += 40
        
        if score > 0:
            scored.append((score, el))
    
    if not scored:
        return None
    
    # Sort by score, return best
    scored.sort(key=lambda x: -x[0])
    
    best_score, best_element = scored[0]
    if best_score < 10:
        return None
    
    logger.info(f"Matched '{intent}' → '{best_element.get('humanDescription')}' "
               f"(score={best_score}, type={best_element.get('elementType')}, "
               f"selector={best_element.get('bestSelector')})")
    
    return best_element


def build_recorded_action(element: Dict, action_type: str, value: str = "", description: str = "") -> Dict:
    """
    Build a Flowstral-compatible RecordedAction from a scanned element.
    
    This creates the EXACT same structure as SmartSelector generates during recording.
    The result can be executed by SmartFinder with full fallback support.
    """
    selectors = element.get('selectors', [])
    best = selectors[0] if selectors else {}
    
    return {
        "id": f"ai_action_{element.get('index', 0)}",
        "type": action_type,
        "qword": action_type.capitalize(),
        "selector": best.get('selector', ''),
        "selectorObj": {
            "primary": best.get('selector', ''),
            "selector": best.get('selector', ''),
            "confidence": best.get('confidence', 0),
            "strategies": selectors,
            "fallbacks": [s['selector'] for s in selectors[1:]],
            "text": element.get('text', ''),
            "testId": element.get('testId', ''),
            "id": element.get('id', ''),
            "name": element.get('name', ''),
            "ariaLabel": element.get('ariaLabel', ''),
            "placeholder": element.get('placeholder', ''),
            "title": element.get('title', ''),
            "role": element.get('role', ''),
            "href": element.get('href', ''),
            "className": element.get('className', ''),
            "tag": element.get('tag', ''),
            "app": "",  # Will be detected
            "appName": "",
        },
        "recipe": {
            "what": {
                "tag": element.get('tag', ''),
                "type": element.get('type', ''),
                "role": element.get('role', ''),
                "text": element.get('text', '')[:50],
            },
            "where": {
                "nearText": element.get('label', ''),
            },
            "which": {
                "testId": element.get('testId', ''),
                "id": element.get('id', ''),
                "name": element.get('name', ''),
                "ariaLabel": element.get('ariaLabel', ''),
                "placeholder": element.get('placeholder', ''),
                "title": element.get('title', ''),
                "cssSelector": best.get('selector', ''),
                "href": element.get('href', ''),
            }
        },
        "element": {
            "tagName": element.get('tag', ''),
            "text": element.get('text', ''),
            "id": element.get('id', ''),
            "name": element.get('name', ''),
            "ariaLabel": element.get('ariaLabel', ''),
        },
        "args": [value] if value else [],
        "value": value,
        "description": description or f"{action_type.capitalize()} \"{element.get('humanDescription', '')}\"",
        "label": element.get('humanDescription', ''),
        "rect": element.get('rect', {}),
    }
