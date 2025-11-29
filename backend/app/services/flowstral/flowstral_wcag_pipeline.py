"""
Flowstral WCAG Accessibility Pipeline
Real-time WCAG scanning with axe-core integration
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


class WCAGPipeline:
    """
    Pipeline B: WCAG Accessibility Pipeline
    Runs axe-core on full page or interacted component
    """
    
    def __init__(self):
        # In production, this would use axe-core via Playwright
        # For now, we'll simulate the structure
        pass
    
    async def scan_page(
        self,
        html: str,
        url: str,
        component_selector: Optional[str] = None,
        wcag_scan_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Run WCAG scan on page or component
        Returns violations with impact and suggested fixes
        
        Args:
            html: HTML content (for fallback checks)
            url: Page URL
            component_selector: Optional component selector
            wcag_scan_data: Optional pre-scanned data from extension (axe-core results)
        """
        snapshot_id = str(uuid4())
        
        # If we have axe-core results from the extension, use those
        if wcag_scan_data and wcag_scan_data.get('violations'):
            violations = self._process_axe_core_results(wcag_scan_data.get('violations', []))
        else:
            # Fallback: basic HTML checks
            violations = self._basic_wcag_check(html)
        
        # Categorize by impact
        critical = [v for v in violations if v.get("impact") == "critical"]
        serious = [v for v in violations if v.get("impact") == "serious"]
        moderate = [v for v in violations if v.get("impact") == "moderate"]
        minor = [v for v in violations if v.get("impact") == "minor"]
        
        snapshot = {
            "wcag_snapshot_id": snapshot_id,
            "url": url,
            "component_selector": component_selector,
            "violations": violations,
            "summary": {
                "total": len(violations),
                "critical": len(critical),
                "serious": len(serious),
                "moderate": len(moderate),
                "minor": len(minor)
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return snapshot
    
    def _basic_wcag_check(self, html: str) -> List[Dict[str, Any]]:
        """Basic WCAG checks (simplified - in production use axe-core)"""
        violations = []
        
        # Check for missing alt text on images
        import re
        images = re.findall(r'<img[^>]*>', html)
        for img in images:
            if 'alt=' not in img and 'alt =' not in img:
                violations.append({
                    "id": "image-alt",
                    "rule": "Images must have alt text",
                    "impact": "critical",
                    "description": "Image missing alt attribute",
                    "help": "Add alt text to describe the image",
                    "helpUrl": "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html",
                    "nodes": [{"html": img}],
                    "suggested_fix": f'Add alt="description" to image tag'
                })
        
        # Check for missing form labels
        inputs = re.findall(r'<input[^>]*>', html)
        for inp in inputs:
            if 'id=' in inp:
                input_id = re.search(r'id=["\']([^"\']+)["\']', inp)
                if input_id:
                    # Check if label exists for this input
                    label_pattern = f'<label[^>]*for=["\']{input_id.group(1)}["\']'
                    if not re.search(label_pattern, html, re.IGNORECASE):
                        violations.append({
                            "id": "label",
                            "rule": "Form inputs must have labels",
                            "impact": "serious",
                            "description": f"Input missing label (id: {input_id.group(1)})",
                            "help": "Add a label element with for attribute matching input id",
                            "helpUrl": "https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html",
                            "nodes": [{"html": inp}],
                            "suggested_fix": f'<label for="{input_id.group(1)}">Label text</label>'
                        })
        
        # Check for missing ARIA labels on interactive elements
        buttons = re.findall(r'<button[^>]*>', html)
        for btn in buttons:
            if 'aria-label=' not in btn and 'aria-labelledby=' not in btn:
                # Check if button has text content
                button_text = re.search(r'<button[^>]*>(.*?)</button>', html, re.DOTALL)
                if not button_text or not button_text.group(1).strip():
                    violations.append({
                        "id": "button-name",
                        "rule": "Buttons must have accessible names",
                        "impact": "serious",
                        "description": "Button missing accessible name",
                        "help": "Add aria-label or visible text to button",
                        "helpUrl": "https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html",
                        "nodes": [{"html": btn}],
                        "suggested_fix": 'Add aria-label="Button description" to button'
                    })
        
        # Check for heading hierarchy
        headings = re.findall(r'<h([1-6])[^>]*>', html)
        if headings:
            heading_levels = [int(h) for h in headings]
            # Check if h1 exists
            if 1 not in heading_levels:
                violations.append({
                    "id": "page-has-heading-one",
                    "rule": "Page must have h1 heading",
                    "impact": "moderate",
                    "description": "Page missing h1 heading",
                    "help": "Add an h1 heading to the page",
                    "helpUrl": "https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html",
                    "nodes": [],
                    "suggested_fix": "<h1>Page Title</h1>"
                })
        
        return violations
    
    def get_violations_by_impact(self, violations: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group violations by impact level"""
        grouped = {
            "critical": [],
            "serious": [],
            "moderate": [],
            "minor": []
        }
        
        for violation in violations:
            impact = violation.get("impact", "minor")
            if impact in grouped:
                grouped[impact].append(violation)
        
        return grouped
    
    def generate_accessibility_report(self, snapshot: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generate comprehensive accessibility report"""
        if not snapshot or not isinstance(snapshot, dict):
            return None
        
        violations = snapshot.get("violations", [])
        if not violations:
            return None
        
        grouped = self.get_violations_by_impact(violations)
        
        report = {
            "snapshot_id": snapshot.get("wcag_snapshot_id"),
            "url": snapshot.get("url", "unknown"),
            "timestamp": snapshot.get("timestamp"),
            "summary": snapshot.get("summary", {}),
            "violations_by_impact": grouped,
            "recommendations": self._generate_recommendations(violations),
            "compliance_status": self._calculate_compliance_status(snapshot.get("summary"))
        }
        
        return report
    
    def _generate_recommendations(self, violations: List[Dict[str, Any]]) -> List[str]:
        """Generate prioritized recommendations"""
        recommendations = []
        
        critical_count = sum(1 for v in violations if v.get("impact") == "critical")
        serious_count = sum(1 for v in violations if v.get("impact") == "serious")
        
        if critical_count > 0:
            recommendations.append(f"Fix {critical_count} critical accessibility issues immediately")
        
        if serious_count > 0:
            recommendations.append(f"Address {serious_count} serious accessibility issues")
        
        # Group by rule type
        rule_types = {}
        for violation in violations:
            rule_id = violation.get("id", "unknown")
            if rule_id not in rule_types:
                rule_types[rule_id] = []
            rule_types[rule_id].append(violation)
        
        for rule_id, rule_violations in rule_types.items():
            if len(rule_violations) > 1:
                recommendations.append(f"Fix {len(rule_violations)} instances of {rule_id}")
        
        return recommendations
    
    def _calculate_compliance_status(self, summary: Dict[str, Any]) -> str:
        """Calculate WCAG compliance status"""
        if summary.get("critical", 0) > 0:
            return "non_compliant"
        elif summary.get("serious", 0) > 5:
            return "needs_improvement"
        elif summary.get("total", 0) == 0:
            return "compliant"
        else:
            return "mostly_compliant"
    
    def _process_axe_core_results(self, axe_violations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process axe-core violation results into our format.
        Enhanced to extract element-specific information like industry-standard tools.
        """
        processed = []
        
        for violation in axe_violations:
            # Map axe-core impact to our impact levels
            impact_map = {
                'critical': 'critical',
                'serious': 'serious',
                'moderate': 'moderate',
                'minor': 'minor'
            }
            
            impact = impact_map.get(violation.get('impact', 'minor'), 'minor')
            
            # Extract element information from nodes (like WAVE, Lighthouse do)
            nodes = violation.get('nodes', [])
            enhanced_nodes = []
            
            for node in nodes:
                html = node.get('html', '')
                target = node.get('target', [])  # CSS selector array from axe-core
                
                # Extract element context
                element_info = self._extract_element_context(html, violation.get('id', ''))
                
                enhanced_node = {
                    "html": html,
                    "selector": target[0] if target else None,
                    "element_type": element_info.get('type', 'element'),
                    "element_context": element_info.get('context', ''),
                    "current_state": element_info.get('current_state', ''),
                    "location_hint": element_info.get('location', '')
                }
                enhanced_nodes.append(enhanced_node)
            
            # Generate element-specific fix suggestion
            fix_suggestion = self._generate_element_specific_fix(violation, enhanced_nodes)
            
            processed.append({
                "id": violation.get('id', 'unknown'),
                "rule": violation.get('description', ''),
                "impact": impact,
                "description": violation.get('help', ''),
                "help": violation.get('help', ''),
                "helpUrl": violation.get('helpUrl', ''),
                "nodes": enhanced_nodes,
                "suggested_fix": fix_suggestion,
                "wcag_criterion": self._extract_wcag_criterion(violation),
                "tags": violation.get('tags', [])
            })
        
        return processed
    
    def _extract_element_context(self, html: str, rule_id: str) -> Dict[str, Any]:
        """
        Extract element context from HTML snippet (like WAVE and Lighthouse do).
        Identifies element type, context, and current state.
        """
        import re
        
        if not html:
            return {"type": "unknown", "context": "", "current_state": "", "location": ""}
        
        element_type = "element"
        context = ""
        current_state = ""
        location = ""
        
        # Extract button information
        if "<button" in html.lower() or "button-name" in rule_id:
            element_type = "button"
            # Try to extract text content
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
            # Check for aria-label
            aria_match = re.search(r'aria-label=["\']([^"\']+)["\']', html, re.IGNORECASE)
            if aria_match:
                current_state = f"Has aria-label: {aria_match.group(1)[:50]}"
            else:
                current_state = "Missing accessible name"
            # Check for icon-only button
            if "icon" in html.lower() or "svg" in html.lower():
                location = "Icon button"
        
        # Extract link information
        elif "<a " in html.lower() or "link-name" in rule_id:
            element_type = "link"
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
            href_match = re.search(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
            if href_match:
                location = f"Link to: {href_match.group(1)[:50]}"
            if not context:
                current_state = "Missing link text"
        
        # Extract image information
        elif "<img" in html.lower() or "image-alt" in rule_id:
            element_type = "image"
            alt_match = re.search(r'alt=["\']([^"\']*)["\']', html, re.IGNORECASE)
            if alt_match:
                current_state = f"Alt text: {alt_match.group(1) or '(empty)'}"
            else:
                current_state = "Missing alt attribute"
            src_match = re.search(r'src=["\']([^"\']+)["\']', html, re.IGNORECASE)
            if src_match:
                context = src_match.group(1).split("/")[-1][:50]
        
        # Extract input information
        elif "<input" in html.lower() or "label" in rule_id:
            element_type = "input"
            type_match = re.search(r'type=["\']([^"\']+)["\']', html, re.IGNORECASE)
            input_type = type_match.group(1) if type_match else "text"
            element_type = f"input ({input_type})"
            label_match = re.search(r'<label[^>]*>([^<]+)</label>', html, re.IGNORECASE)
            if label_match:
                context = label_match.group(1).strip()[:50]
            else:
                current_state = "Missing associated label"
            id_match = re.search(r'id=["\']([^"\']+)["\']', html, re.IGNORECASE)
            if id_match:
                location = f"Input ID: {id_match.group(1)}"
        
        # Extract heading information
        elif re.search(r'<h[1-6]', html, re.IGNORECASE):
            element_type = "heading"
            level_match = re.search(r'<h([1-6])', html, re.IGNORECASE)
            level = level_match.group(1) if level_match else "?"
            element_type = f"heading (h{level})"
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
        
        # Extract form information
        elif "<form" in html.lower():
            element_type = "form"
            location = "Form element"
        
        # Generic element - try to identify tag
        else:
            tag_match = re.search(r'<(\w+)', html, re.IGNORECASE)
            if tag_match:
                element_type = tag_match.group(1)
            text_match = re.search(r'>([^<]+)<', html)
            if text_match:
                context = text_match.group(1).strip()[:50]
        
        return {
            "type": element_type,
            "context": context or "No context available",
            "current_state": current_state or "Needs review",
            "location": location or ""
        }
    
    def _extract_wcag_criterion(self, violation: Dict[str, Any]) -> str:
        """Extract WCAG criterion from violation tags (e.g., 'wcag2a', 'wcag21aa')"""
        tags = violation.get('tags', [])
        for tag in tags:
            if tag.startswith('wcag'):
                # Convert 'wcag21aa' to 'WCAG 2.1 AA'
                if 'wcag21aa' in tag:
                    return "WCAG 2.1 AA"
                elif 'wcag21a' in tag:
                    return "WCAG 2.1 A"
                elif 'wcag2aa' in tag:
                    return "WCAG 2.0 AA"
                elif 'wcag2a' in tag:
                    return "WCAG 2.0 A"
        return "WCAG 2.1"
    
    def _generate_element_specific_fix(self, violation: Dict[str, Any], nodes: List[Dict[str, Any]]) -> str:
        """
        Generate element-specific fix suggestion based on actual element structure.
        Similar to how WAVE and Lighthouse provide contextual fixes.
        """
        rule_id = violation.get('id', '')
        help_text = violation.get('help', '')
        
        # Use first node for context
        if nodes:
            node = nodes[0]
            element_type = node.get('element_type', '')
            html = node.get('html', '')
            
            # Generate specific fix based on element type and HTML
            if 'button' in element_type.lower():
                if 'aria-label' not in html.lower():
                    return 'Add aria-label="[descriptive name]" attribute to button element'
                elif not node.get('context'):
                    return 'Add visible text content or aria-label to button'
            
            elif 'image' in element_type.lower() or 'img' in element_type.lower():
                if 'alt=' not in html.lower():
                    return 'Add alt="[description of image]" attribute to img element'
                elif 'alt=""' in html.lower():
                    return 'Add descriptive alt text or mark as decorative with alt="" and role="presentation"'
            
            elif 'input' in element_type.lower():
                return 'Add a <label> element with for attribute matching input id, or use aria-label'
            
            elif 'link' in element_type.lower() or '<a' in html.lower():
                if not node.get('context'):
                    return 'Add visible link text or aria-label to anchor element'
        
        # Fallback to rule-based fixes
        fix_map = {
            'image-alt': 'Add alt="[description]" attribute to image tag',
            'button-name': 'Add aria-label="[descriptive name]" or visible text to button',
            'label': 'Add a <label> element with for attribute matching input id',
            'color-contrast': 'Increase color contrast ratio to meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)',
            'heading-order': 'Ensure heading hierarchy follows h1 -> h2 -> h3 order without skipping levels',
            'link-name': 'Add accessible name to link (text content or aria-label)',
            'form-field-multiple-labels': 'Remove duplicate labels, keep only one',
            'aria-hidden-focus': 'Remove aria-hidden="true" from focusable elements',
            'duplicate-id': 'Ensure each element has a unique id attribute'
        }
        
        return fix_map.get(rule_id, help_text or 'Review and fix accessibility issue')
    
    def _generate_fix_suggestion(self, violation: Dict[str, Any]) -> str:
        """Generate a suggested fix for a violation"""
        rule_id = violation.get('id', '')
        help_text = violation.get('help', '')
        
        # Common fixes based on rule ID
        fix_map = {
            'image-alt': 'Add alt="description" attribute to image tag',
            'button-name': 'Add aria-label="Button description" or visible text to button',
            'label': 'Add a <label> element with for attribute matching input id',
            'color-contrast': 'Increase color contrast ratio to meet WCAG AA standards (4.5:1 for normal text)',
            'heading-order': 'Ensure heading hierarchy follows h1 -> h2 -> h3 order without skipping levels',
            'link-name': 'Add accessible name to link (text content or aria-label)'
        }
        
        return fix_map.get(rule_id, help_text)

