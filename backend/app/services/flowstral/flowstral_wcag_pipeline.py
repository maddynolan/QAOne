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
        """
        Enhanced basic WCAG checks — runs when axe-core is unavailable.
        Covers 12+ common WCAG violation categories via regex analysis.
        """
        violations = []
        if not html or len(html) < 50:
            return violations

        import re

        # 1. Images missing alt text (WCAG 1.1.1)
        images = re.findall(r'<img[^>]*?>', html, re.IGNORECASE | re.DOTALL)
        for img in images:
            if 'alt=' not in img.lower():
                violations.append({
                    "id": "image-alt",
                    "rule": "Images must have alt text",
                    "impact": "critical",
                    "description": "Image element is missing alt attribute. Screen readers cannot describe the image.",
                    "help": "Add alt text to describe the image content, or alt=\"\" for decorative images",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/image-alt",
                    "nodes": [{"html": img[:200]}],
                    "wcag_criterion": "WCAG 1.1.1",
                    "suggested_fix": 'Add alt="[descriptive text]" attribute to <img> element'
                })
            elif re.search(r'alt=[\"\'][\s]*[\"\']', img, re.IGNORECASE):
                # Empty alt on non-decorative image
                if 'role="presentation"' not in img.lower() and 'role="none"' not in img.lower():
                    src = re.search(r'src=["\']([^"\']+)', img)
                    src_name = src.group(1).split("/")[-1] if src else "unknown"
                    violations.append({
                        "id": "image-alt",
                        "rule": "Images should have meaningful alt text",
                        "impact": "moderate",
                        "description": f"Image has empty alt text but no decorative role ({src_name}). If decorative, add role=\"presentation\".",
                        "help": "Add descriptive alt text or mark as decorative",
                        "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/image-alt",
                        "nodes": [{"html": img[:200]}],
                        "wcag_criterion": "WCAG 1.1.1",
                        "suggested_fix": 'Add descriptive alt text, or add role="presentation" if decorative'
                    })

        # 2. Form inputs missing labels (WCAG 1.3.1, 4.1.2)
        inputs = re.findall(r'<input[^>]*?>', html, re.IGNORECASE | re.DOTALL)
        for inp in inputs:
            input_type = re.search(r'type=["\']([^"\']+)', inp, re.IGNORECASE)
            itype = input_type.group(1).lower() if input_type else "text"
            if itype in ('hidden', 'submit', 'button', 'reset', 'image'):
                continue
            has_label = False
            input_id = re.search(r'id=["\']([^"\']+)["\']', inp, re.IGNORECASE)
            if input_id:
                label_pat = f'<label[^>]*for=["\']\\s*{re.escape(input_id.group(1))}\\s*["\']'
                if re.search(label_pat, html, re.IGNORECASE):
                    has_label = True
            if 'aria-label=' in inp.lower() or 'aria-labelledby=' in inp.lower() or 'title=' in inp.lower():
                has_label = True
            if not has_label:
                violations.append({
                    "id": "label",
                    "rule": "Form inputs must have associated labels",
                    "impact": "serious",
                    "description": f"Input element (type={itype}) has no associated <label>, aria-label, or title attribute.",
                    "help": "Associate a label with every form control",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/label",
                    "nodes": [{"html": inp[:200]}],
                    "wcag_criterion": "WCAG 4.1.2",
                    "suggested_fix": f'Add <label for="{input_id.group(1) if input_id else "input-id"}">[Label]</label> or aria-label="[Label]"'
                })

        # 3. Buttons missing accessible names (WCAG 4.1.2)
        button_matches = re.finditer(r'<button[^>]*>(.*?)</button>', html, re.IGNORECASE | re.DOTALL)
        for btn_match in button_matches:
            btn_tag = btn_match.group(0)
            btn_content = btn_match.group(1).strip()
            # Strip inner HTML tags to check for text
            text_only = re.sub(r'<[^>]+>', '', btn_content).strip()
            if not text_only and 'aria-label=' not in btn_tag.lower() and 'aria-labelledby=' not in btn_tag.lower() and 'title=' not in btn_tag.lower():
                violations.append({
                    "id": "button-name",
                    "rule": "Buttons must have an accessible name",
                    "impact": "serious",
                    "description": "Button element has no visible text or aria-label. Screen readers cannot identify it.",
                    "help": "Add visible text content or aria-label to button",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/button-name",
                    "nodes": [{"html": btn_tag[:200]}],
                    "wcag_criterion": "WCAG 4.1.2",
                    "suggested_fix": 'Add aria-label="[Button purpose]" or visible text inside <button>'
                })

        # 4. Links missing accessible names (WCAG 4.1.2)
        link_matches = re.finditer(r'<a\s[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL)
        for link_match in link_matches:
            link_tag = link_match.group(0)
            link_content = link_match.group(1).strip()
            text_only = re.sub(r'<[^>]+>', '', link_content).strip()
            if not text_only and 'aria-label=' not in link_tag.lower() and 'aria-labelledby=' not in link_tag.lower():
                href = re.search(r'href=["\']([^"\']*)', link_tag, re.IGNORECASE)
                href_val = href.group(1) if href else "#"
                violations.append({
                    "id": "link-name",
                    "rule": "Links must have an accessible name",
                    "impact": "serious",
                    "description": f"Link to '{href_val[:50]}' has no visible text or aria-label.",
                    "help": "Add visible text content or aria-label to link",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/link-name",
                    "nodes": [{"html": link_tag[:200]}],
                    "wcag_criterion": "WCAG 4.1.2",
                    "suggested_fix": 'Add visible link text or aria-label="[Link purpose]"'
                })

        # 5. Missing document language (WCAG 3.1.1)
        if '<html' in html.lower() and not re.search(r'<html[^>]*\slang=', html, re.IGNORECASE):
            violations.append({
                "id": "html-has-lang",
                "rule": "HTML element must have a lang attribute",
                "impact": "serious",
                "description": "The <html> element does not have a lang attribute, which is required for screen readers to identify the page language.",
                "help": "Add a lang attribute to the <html> element",
                "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/html-has-lang",
                "nodes": [{"html": re.search(r'<html[^>]*>', html, re.IGNORECASE).group(0)[:200] if re.search(r'<html[^>]*>', html, re.IGNORECASE) else "<html>"}],
                "wcag_criterion": "WCAG 3.1.1",
                "suggested_fix": '<html lang="en"> (or appropriate language code)'
            })

        # 6. Missing document title (WCAG 2.4.2)
        if '<head' in html.lower():
            if not re.search(r'<title[^>]*>[^<]+</title>', html, re.IGNORECASE):
                violations.append({
                    "id": "document-title",
                    "rule": "Document must have a <title> element",
                    "impact": "serious",
                    "description": "Page is missing a <title> element. Screen readers announce the page title when users navigate between pages.",
                    "help": "Add a descriptive <title> element to the <head>",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/document-title",
                    "nodes": [],
                    "wcag_criterion": "WCAG 2.4.2",
                    "suggested_fix": "<title>Descriptive Page Title</title> in <head>"
                })

        # 7. Heading hierarchy (WCAG 1.3.1)
        headings = re.findall(r'<h([1-6])[^>]*>', html, re.IGNORECASE)
        if headings:
            heading_levels = [int(h) for h in headings]
            if 1 not in heading_levels:
                violations.append({
                    "id": "page-has-heading-one",
                    "rule": "Page must contain a level-one heading",
                    "impact": "moderate",
                    "description": "Page does not have an <h1> heading. Screen readers use headings to understand page structure.",
                    "help": "Ensure the page has at least one <h1> heading",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/page-has-heading-one",
                    "nodes": [],
                    "wcag_criterion": "WCAG 1.3.1",
                    "suggested_fix": "Add <h1>Page Title</h1> as the main heading"
                })
            # Check for skipped levels
            for i in range(1, len(heading_levels)):
                if heading_levels[i] > heading_levels[i - 1] + 1:
                    violations.append({
                        "id": "heading-order",
                        "rule": "Heading levels should only increase by one",
                        "impact": "moderate",
                        "description": f"Heading level jumps from h{heading_levels[i-1]} to h{heading_levels[i]}, skipping h{heading_levels[i-1]+1}.",
                        "help": "Ensure heading levels do not skip (e.g., h2 should not be followed by h4)",
                        "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/heading-order",
                        "nodes": [],
                        "wcag_criterion": "WCAG 1.3.1",
                        "suggested_fix": f"Change h{heading_levels[i]} to h{heading_levels[i-1]+1} or add missing intermediate headings"
                    })
                    break  # Report first skip only

        # 8. Missing landmark regions (WCAG 1.3.1)
        has_main = bool(re.search(r'<main[\s>]|role=["\']main["\']', html, re.IGNORECASE))
        has_nav = bool(re.search(r'<nav[\s>]|role=["\']navigation["\']', html, re.IGNORECASE))
        if not has_main and len(html) > 1000:
            violations.append({
                "id": "landmark-one-main",
                "rule": "Page should have one main landmark",
                "impact": "moderate",
                "description": "Page does not have a <main> landmark region. Screen readers use landmarks to navigate between sections.",
                "help": "Wrap the primary content area in a <main> element",
                "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/landmark-one-main",
                "nodes": [],
                "wcag_criterion": "WCAG 1.3.1",
                "suggested_fix": "Wrap primary content with <main>...</main>"
            })

        # 9. Missing skip navigation link (WCAG 2.4.1)
        first_500 = html[:2000].lower()
        if has_nav and 'skip' not in first_500 and '#main' not in first_500 and '#content' not in first_500:
            violations.append({
                "id": "skip-link",
                "rule": "Page should have a skip navigation link",
                "impact": "moderate",
                "description": "No skip navigation link found. Keyboard-only users must tab through all navigation items to reach main content.",
                "help": "Add a skip link as the first focusable element",
                "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/skip-link",
                "nodes": [],
                "wcag_criterion": "WCAG 2.4.1",
                "suggested_fix": '<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>'
            })

        # 10. Inline event handlers without keyboard equivalents (WCAG 2.1.1)
        onclick_divs = re.findall(r'<(?:div|span|td|li|p)[^>]*onclick=[^>]*>', html, re.IGNORECASE)
        for elem in onclick_divs[:5]:  # Cap at 5
            if 'role=' not in elem.lower() and 'tabindex=' not in elem.lower():
                violations.append({
                    "id": "interactive-element-role",
                    "rule": "Non-interactive elements with click handlers need role and tabindex",
                    "impact": "serious",
                    "description": "Non-interactive element has onclick handler but no role or tabindex. Keyboard users cannot access it.",
                    "help": "Add role=\"button\" and tabindex=\"0\" or use a <button> element instead",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/interactive-supports-focus",
                    "nodes": [{"html": elem[:200]}],
                    "wcag_criterion": "WCAG 2.1.1",
                    "suggested_fix": 'Add role="button" tabindex="0" and keyboard event handlers, or use <button> instead'
                })

        # 11. Iframes missing title (WCAG 4.1.2)
        iframes = re.findall(r'<iframe[^>]*>', html, re.IGNORECASE)
        for iframe in iframes:
            if 'title=' not in iframe.lower() and 'aria-label=' not in iframe.lower():
                violations.append({
                    "id": "frame-title",
                    "rule": "Frames must have an accessible name",
                    "impact": "serious",
                    "description": "iframe element is missing a title attribute. Screen readers need it to describe the frame content.",
                    "help": "Add a title attribute to the <iframe> element",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/frame-title",
                    "nodes": [{"html": iframe[:200]}],
                    "wcag_criterion": "WCAG 4.1.2",
                    "suggested_fix": 'Add title="[Description of iframe content]" to <iframe>'
                })

        # 12. Meta viewport disabling zoom (WCAG 1.4.4)
        viewport = re.search(r'<meta[^>]*name=["\']viewport["\'][^>]*content=["\']([^"\']+)["\']', html, re.IGNORECASE)
        if viewport:
            content = viewport.group(1).lower()
            if 'user-scalable=no' in content or 'user-scalable=0' in content:
                violations.append({
                    "id": "meta-viewport",
                    "rule": "Zooming and scaling must not be disabled",
                    "impact": "critical",
                    "description": "Meta viewport has user-scalable=no, preventing users from zooming. This is critical for users with low vision.",
                    "help": "Remove user-scalable=no from viewport meta tag",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/meta-viewport",
                    "nodes": [{"html": viewport.group(0)[:200]}],
                    "wcag_criterion": "WCAG 1.4.4",
                    "suggested_fix": "Remove user-scalable=no from <meta name=\"viewport\"> content"
                })
            max_scale = re.search(r'maximum-scale=([0-9.]+)', content)
            if max_scale and float(max_scale.group(1)) < 2:
                violations.append({
                    "id": "meta-viewport-large",
                    "rule": "maximum-scale should be at least 2",
                    "impact": "serious",
                    "description": f"Meta viewport maximum-scale={max_scale.group(1)} prevents adequate zooming.",
                    "help": "Set maximum-scale to at least 2, or remove it entirely",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/meta-viewport-large",
                    "nodes": [{"html": viewport.group(0)[:200]}],
                    "wcag_criterion": "WCAG 1.4.4",
                    "suggested_fix": "Set maximum-scale=5 or remove the maximum-scale restriction"
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

