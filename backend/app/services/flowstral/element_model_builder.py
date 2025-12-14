"""
Element Model Builder
Analyzes elements and generates multiple identifiers (Tosca-style)
Works across all app types with app-specific priorities
"""

import logging
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.automation.application_detector import ApplicationDetector, ApplicationType
from app.services.flowstral.element_model_service import get_element_model_service

logger = logging.getLogger(__name__)


class ElementModelBuilder:
    """
    Builds element models with multiple identifiers.
    
    Key Features:
    - Analyzes elements using ApplicationDetector
    - Generates app-specific identifiers
    - Prioritizes identifiers based on app type
    - Creates human-readable element names
    """
    
    def __init__(self):
        self.element_model_service = get_element_model_service()
    
    def generate_element_name(
        self,
        element_data: Dict[str, Any],
        page_context: Optional[str] = None
    ) -> str:
        """
        Generate a human-readable element name.
        
        Examples:
        - "login_submit_button"
        - "checkout_email_input"
        - "product_add_to_cart_button"
        """
        # Try to get meaningful text
        text_content = element_data.get("text_content", "").strip()
        aria_label = element_data.get("accessibility", {}).get("aria_label", "")
        title = element_data.get("title", "")
        element_id = element_data.get("id", "")
        tag_name = element_data.get("tag_name", "").lower()
        
        # Priority: aria_label > title > text_content > id > tag_name
        name_source = aria_label or title or text_content or element_id or tag_name
        
        # Clean up the name
        name = re.sub(r'[^a-zA-Z0-9\s]', '', name_source)
        name = re.sub(r'\s+', '_', name)
        name = name.lower()
        name = name[:50]  # Limit length
        
        # Add element type suffix if not obvious
        if tag_name == "button" and not name.endswith("_button"):
            name += "_button"
        elif tag_name in ["input", "textarea"] and not name.endswith("_input"):
            name += "_input"
        elif tag_name == "a" and not name.endswith("_link"):
            name += "_link"
        
        # Add page context prefix if provided
        if page_context:
            name = f"{page_context}_{name}"
        
        return name or f"{tag_name}_element"
    
    def generate_identifiers(
        self,
        element_data: Dict[str, Any],
        application_type: ApplicationType
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple identifiers for an element based on app type.
        
        Returns list of identifier dictionaries with priority, confidence, and Playwright locators.
        """
        identifiers = []
        tag_name = element_data.get("tag_name", "").lower()
        attributes = element_data.get("attributes", {}) or {}
        text_content = element_data.get("text_content", "").strip()
        classes = element_data.get("class_name", "").split() if element_data.get("class_name") else []
        
        # Get accessibility attributes
        accessibility = element_data.get("accessibility", {}) or {}
        aria_label = accessibility.get("aria_label") or attributes.get("aria-label")
        aria_labelledby = accessibility.get("aria_labelledby") or attributes.get("aria-labelledby")
        role = accessibility.get("role") or attributes.get("role")
        
        # Use ApplicationDetector to analyze element
        analysis = ApplicationDetector.analyze_element(element_data)
        
        # Generate identifiers based on app type
        if application_type == ApplicationType.SALESFORCE:
            identifiers = self._generate_salesforce_identifiers(
                tag_name, attributes, text_content, analysis
            )
        elif application_type == ApplicationType.SAP:
            identifiers = self._generate_sap_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.ORACLE:
            identifiers = self._generate_oracle_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.PEGA:
            identifiers = self._generate_pega_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.WORKDAY:
            identifiers = self._generate_workday_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.SERVICENOW:
            identifiers = self._generate_servicenow_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.MICROSOFT_DYNAMICS:
            identifiers = self._generate_microsoft_dynamics_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.NETSUITE:
            identifiers = self._generate_netsuite_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.ORACLE_SIEBEL:
            identifiers = self._generate_oracle_siebel_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.ORACLE_EBS:
            identifiers = self._generate_oracle_ebs_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.GUIDEWIRE:
            identifiers = self._generate_guidewire_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.AVALOQ:
            identifiers = self._generate_avaloq_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.OUTSYSTEMS:
            identifiers = self._generate_outsystems_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.MENDIX:
            identifiers = self._generate_mendix_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type == ApplicationType.SNOWFLAKE:
            identifiers = self._generate_snowflake_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        elif application_type in [ApplicationType.REACT, ApplicationType.ANGULAR, ApplicationType.VUE]:
            identifiers = self._generate_framework_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        else:
            identifiers = self._generate_generic_identifiers(
                tag_name, attributes, text_content, aria_label, role, analysis
            )
        
        # Ensure we have at least one identifier
        if not identifiers:
            # Fallback to basic CSS selector
            identifiers.append({
                "type": "css",
                "value": tag_name,
                "priority": 999,
                "confidence": 0.5,
                "app_specific": False,
                "playwright_locator": f"page.locator('{tag_name}').first()"
            })
        
        return identifiers
    
    def _generate_salesforce_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for Salesforce elements"""
        identifiers = []
        priority = 1
        
        # 1. Title attribute (highest priority for Salesforce)
        if attributes.get("title"):
            title = attributes["title"]
            identifiers.append({
                "type": "title_attribute",
                "value": title,
                "priority": priority,
                "confidence": 0.95,
                "app_specific": True,
                "app_type": "salesforce",
                "playwright_locator": f'page.locator(\'{tag_name}[title="{title}"]\')',
                "reason": "Title attribute is most stable in Salesforce LWC"
            })
            priority += 1
        
        # 2. Href attribute (for links)
        if tag_name == "a" and attributes.get("href"):
            href = attributes["href"]
            # Only use if href is meaningful (not just #)
            if href and href != "#" and not href.startswith("javascript:"):
                identifiers.append({
                    "type": "href_attribute",
                    "value": href,
                    "priority": priority,
                    "confidence": 0.90,
                    "app_specific": True,
                    "app_type": "salesforce",
                    "playwright_locator": f'page.locator(\'a[href="{href}"]\')',
                    "reason": "Href attribute is stable in Salesforce"
                })
                priority += 1
        
        # 3. Data attributes
        data_attrs = {k: v for k, v in attributes.items() if k.startswith("data-")}
        if data_attrs:
            # Build selector from data attributes
            selector_parts = [tag_name]
            for key, value in data_attrs.items():
                if value:
                    selector_parts.append(f'[{key}="{value}"]')
                else:
                    selector_parts.append(f'[{key}]')
            
            selector = ''.join(selector_parts)
            identifiers.append({
                "type": "data_attribute",
                "value": selector,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": True,
                "app_type": "salesforce",
                "playwright_locator": f"page.locator('{selector}')",
                "reason": "Data attributes are stable in Salesforce"
            })
            priority += 1
        
        # 4. Role + name (semantic)
        if text_content and len(text_content) < 100:
            inferred_role = self._infer_role(tag_name, attributes)
            if inferred_role:
                identifiers.append({
                    "type": "role_name",
                    "role": inferred_role,
                    "name": text_content[:50],
                    "priority": priority,
                    "confidence": 0.80,
                    "app_specific": False,
                    "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                    "reason": "Semantic locator with role and name"
                })
                priority += 1
        
        # 5. Text content (fallback)
        if text_content and len(text_content) < 100:
            identifiers.append({
                "type": "text",
                "value": text_content,
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByText("{text_content}")',
                "reason": "Text-based selector"
            })
            priority += 1
        
        return identifiers
    
    def _generate_framework_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for React/Angular/Vue elements"""
        identifiers = []
        priority = 1
        
        # 1. data-testid (highest priority for frameworks)
        test_id = attributes.get("data-testid") or attributes.get("data-test-id")
        if test_id:
            identifiers.append({
                "type": "testid",
                "value": test_id,
                "priority": priority,
                "confidence": 0.99,
                "app_specific": False,
                "playwright_locator": f"page.getByTestId('{test_id}')",
                "reason": "data-testid is most stable and recommended"
            })
            priority += 1
        
        # 2. Stable ID (non-dynamic)
        element_id = attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.95,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 3. Role + name (semantic)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role:
            name = aria_label or text_content
            if name and len(name) < 100:
                identifiers.append({
                    "type": "role_name",
                    "role": inferred_role,
                    "name": name[:50],
                    "priority": priority,
                    "confidence": 0.90,
                    "app_specific": False,
                    "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{name[:50]}" }})',
                    "reason": "Semantic locator with role and name"
                })
                priority += 1
        
        # 4. Label-based (for inputs)
        if tag_name in ["input", "textarea", "select"]:
            label = aria_label or attributes.get("aria-label") or attributes.get("placeholder")
            if label:
                identifiers.append({
                    "type": "label",
                    "value": label,
                    "priority": priority,
                    "confidence": 0.85,
                    "app_specific": False,
                    "playwright_locator": f'page.getByLabel("{label}")',
                    "reason": "Label-based selector for form fields"
                })
                priority += 1
        
        # 5. Text content (fallback)
        if text_content and len(text_content) < 100:
            identifiers.append({
                "type": "text",
                "value": text_content,
                "priority": priority,
                "confidence": 0.80,
                "app_specific": False,
                "playwright_locator": f'page.getByText("{text_content}")',
                "reason": "Text-based selector"
            })
            priority += 1
        
        return identifiers
    
    def _generate_generic_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for generic web elements"""
        identifiers = []
        priority = 1
        
        # 1. Stable ID
        element_id = attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.95,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 2. Role + name (semantic)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role:
            name = aria_label or text_content
            if name and len(name) < 100:
                identifiers.append({
                    "type": "role_name",
                    "role": inferred_role,
                    "name": name[:50],
                    "priority": priority,
                    "confidence": 0.90,
                    "app_specific": False,
                    "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{name[:50]}" }})',
                    "reason": "Semantic locator with role and name"
                })
                priority += 1
        
        # 3. Label-based (for inputs)
        if tag_name in ["input", "textarea", "select"]:
            label = aria_label or attributes.get("aria-label") or attributes.get("placeholder")
            if label:
                identifiers.append({
                    "type": "label",
                    "value": label,
                    "priority": priority,
                    "confidence": 0.85,
                    "app_specific": False,
                    "playwright_locator": f'page.getByLabel("{label}")',
                    "reason": "Label-based selector for form fields"
                })
                priority += 1
        
        # 4. Text content
        if text_content and len(text_content) < 100:
            identifiers.append({
                "type": "text",
                "value": text_content,
                "priority": priority,
                "confidence": 0.80,
                "app_specific": False,
                "playwright_locator": f'page.getByText("{text_content}")',
                "reason": "Text-based selector"
            })
            priority += 1
        
        # 5. CSS fallback
        if attributes.get("class"):
            classes = attributes["class"].split()
            stable_classes = [c for c in classes if not self._is_dynamic_class(c)]
            if stable_classes:
                class_selector = f'{tag_name}.{".".join(stable_classes[:2])}'
                identifiers.append({
                    "type": "css",
                    "value": class_selector,
                    "priority": priority,
                    "confidence": 0.70,
                    "app_specific": False,
                    "playwright_locator": f"page.locator('{class_selector}')",
                    "reason": "CSS class selector (stable classes only)"
                })
        
        return identifiers
    
    def _generate_microsoft_dynamics_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for Microsoft Dynamics 365 elements"""
        identifiers = []
        priority = 1
        
        # 1. Dynamics data-dyn-control-id (most stable)
        if attributes.get("data-dyn-control-id"):
            identifiers.append({
                "type": "dynamics_control_id",
                "value": attributes["data-dyn-control-id"],
                "priority": priority,
                "confidence": 0.95,
                "app_specific": True,
                "app_type": "microsoft_dynamics",
                "playwright_locator": f'page.locator(\'[data-dyn-control-id="{attributes["data-dyn-control-id"]}"]\')',
                "reason": "Microsoft Dynamics control ID is most stable"
            })
            priority += 1
        
        # 2. Dynamics data-dyn-* attributes
        dyn_attrs = {k: v for k, v in attributes.items() if k.startswith("data-dyn-")}
        if dyn_attrs:
            for key, value in dyn_attrs.items():
                if value and key != "data-dyn-control-id":
                    identifiers.append({
                        "type": "dynamics_data_attribute",
                        "value": f"{key}={value}",
                        "priority": priority,
                        "confidence": 0.90,
                        "app_specific": True,
                        "app_type": "microsoft_dynamics",
                        "playwright_locator": f'page.locator(\'[{key}="{value}"]\')',
                        "reason": "Microsoft Dynamics data attribute"
                    })
                    priority += 1
                    break
        
        # 3. Microsoft CRM classes (ms-crm-)
        classes = attributes.get("class", "").split()
        crm_classes = [c for c in classes if c.startswith("ms-crm-")]
        if crm_classes:
            class_selector = f'{tag_name}.{".".join(crm_classes[:2])}'
            identifiers.append({
                "type": "dynamics_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": True,
                "app_type": "microsoft_dynamics",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "Microsoft Dynamics class selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _generate_netsuite_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for NetSuite elements"""
        identifiers = []
        priority = 1
        
        # 1. NetSuite data-ns-* attributes (most stable)
        ns_attrs = {k: v for k, v in attributes.items() if k.startswith("data-ns-")}
        if ns_attrs:
            for key, value in ns_attrs.items():
                if value:
                    identifiers.append({
                        "type": "netsuite_data_attribute",
                        "value": f"{key}={value}",
                        "priority": priority,
                        "confidence": 0.95,
                        "app_specific": True,
                        "app_type": "netsuite",
                        "playwright_locator": f'page.locator(\'[{key}="{value}"]\')',
                        "reason": "NetSuite data attribute is most stable"
                    })
                    priority += 1
                    break
        
        # 2. NetSuite classes (ns-, uir-)
        classes = attributes.get("class", "").split()
        ns_classes = [c for c in classes if c.startswith(("ns-", "uir-"))]
        if ns_classes:
            class_selector = f'{tag_name}.{".".join(ns_classes[:2])}'
            identifiers.append({
                "type": "netsuite_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.90,
                "app_specific": True,
                "app_type": "netsuite",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "NetSuite class selector"
            })
            priority += 1
        
        # 3. Stable ID (if not dynamic)
        element_id = attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _generate_oracle_siebel_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for Oracle Siebel elements"""
        identifiers = []
        priority = 1
        
        # 1. Siebel data-sbl-* attributes
        sbl_attrs = {k: v for k, v in attributes.items() if k.startswith("data-sbl-")}
        if sbl_attrs:
            for key, value in sbl_attrs.items():
                if value:
                    identifiers.append({
                        "type": "siebel_data_attribute",
                        "value": f"{key}={value}",
                        "priority": priority,
                        "confidence": 0.95,
                        "app_specific": True,
                        "app_type": "oracle_siebel",
                        "playwright_locator": f'page.locator(\'[{key}="{value}"]\')',
                        "reason": "Oracle Siebel data attribute is most stable"
                    })
                    priority += 1
                    break
        
        # 2. Siebel element IDs (s_ prefix)
        element_id = attributes.get("id", "")
        if element_id and element_id.startswith("s_"):
            identifiers.append({
                "type": "siebel_id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.90,
                "app_specific": True,
                "app_type": "oracle_siebel",
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Oracle Siebel element ID"
            })
            priority += 1
        
        # 3. Siebel classes (sbl-)
        classes = attributes.get("class", "").split()
        sbl_classes = [c for c in classes if c.startswith("sbl-")]
        if sbl_classes:
            class_selector = f'{tag_name}.{".".join(sbl_classes[:2])}'
            identifiers.append({
                "type": "siebel_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": True,
                "app_type": "oracle_siebel",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "Oracle Siebel class selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _generate_oracle_ebs_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for Oracle EBS (E-Business Suite) elements"""
        identifiers = []
        priority = 1
        
        # 1. Oracle Forms ID (x1 followed by 32 hex chars)
        element_id = attributes.get("id", "")
        if element_id and re.match(r'^x1[0-9a-f]{32}$', element_id, re.IGNORECASE):
            identifiers.append({
                "type": "oracle_forms_id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.95,
                "app_specific": True,
                "app_type": "oracle_ebs",
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Oracle Forms ID is most stable"
            })
            priority += 1
        
        # 2. Oracle EBS classes (ebs-)
        classes = attributes.get("class", "").split()
        ebs_classes = [c for c in classes if c.startswith("ebs-")]
        if ebs_classes:
            class_selector = f'{tag_name}.{".".join(ebs_classes[:2])}'
            identifiers.append({
                "type": "oracle_ebs_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.90,
                "app_specific": True,
                "app_type": "oracle_ebs",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "Oracle EBS class selector"
            })
            priority += 1
        
        # 3. Stable ID (if not dynamic)
        if element_id and not self._is_dynamic_id(element_id) and not element_id.startswith("x1"):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _generate_guidewire_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for Guidewire elements"""
        identifiers = []
        priority = 1
        
        # 1. Guidewire data-gw-* attributes (most stable)
        gw_attrs = {k: v for k, v in attributes.items() if k.startswith("data-gw-")}
        if gw_attrs:
            for key, value in gw_attrs.items():
                if value:
                    identifiers.append({
                        "type": "guidewire_data_attribute",
                        "value": f"{key}={value}",
                        "priority": priority,
                        "confidence": 0.95,
                        "app_specific": True,
                        "app_type": "guidewire",
                        "playwright_locator": f'page.locator(\'[{key}="{value}"]\')',
                        "reason": "Guidewire data attribute is most stable"
                    })
                    priority += 1
                    break
        
        # 2. Guidewire classes (gw-)
        classes = attributes.get("class", "").split()
        gw_classes = [c for c in classes if c.startswith("gw-")]
        if gw_classes:
            class_selector = f'{tag_name}.{".".join(gw_classes[:2])}'
            identifiers.append({
                "type": "guidewire_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.90,
                "app_specific": True,
                "app_type": "guidewire",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "Guidewire class selector"
            })
            priority += 1
        
        # 3. Stable ID (if not dynamic)
        element_id = attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _generate_avaloq_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for Avaloq elements"""
        identifiers = []
        priority = 1
        
        # 1. Avaloq data-avq-* attributes
        avq_attrs = {k: v for k, v in attributes.items() if k.startswith("data-avq-")}
        if avq_attrs:
            for key, value in avq_attrs.items():
                if value:
                    identifiers.append({
                        "type": "avaloq_data_attribute",
                        "value": f"{key}={value}",
                        "priority": priority,
                        "confidence": 0.95,
                        "app_specific": True,
                        "app_type": "avaloq",
                        "playwright_locator": f'page.locator(\'[{key}="{value}"]\')',
                        "reason": "Avaloq data attribute is most stable"
                    })
                    priority += 1
                    break
        
        # 2. Avaloq classes (avq-)
        classes = attributes.get("class", "").split()
        avq_classes = [c for c in classes if c.startswith("avq-")]
        if avq_classes:
            class_selector = f'{tag_name}.{".".join(avq_classes[:2])}'
            identifiers.append({
                "type": "avaloq_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.90,
                "app_specific": True,
                "app_type": "avaloq",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "Avaloq class selector"
            })
            priority += 1
        
        # 3. Stable ID (if not dynamic)
        element_id = attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _generate_outsystems_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for OutSystems elements"""
        identifiers = []
        priority = 1
        
        # 1. OutSystems data-os-* attributes
        os_attrs = {k: v for k, v in attributes.items() if k.startswith("data-os-")}
        if os_attrs:
            for key, value in os_attrs.items():
                if value:
                    identifiers.append({
                        "type": "outsystems_data_attribute",
                        "value": f"{key}={value}",
                        "priority": priority,
                        "confidence": 0.95,
                        "app_specific": True,
                        "app_type": "outsystems",
                        "playwright_locator": f'page.locator(\'[{key}="{value}"]\')',
                        "reason": "OutSystems data attribute is most stable"
                    })
                    priority += 1
                    break
        
        # 2. OutSystems classes (os-)
        classes = attributes.get("class", "").split()
        os_classes = [c for c in classes if c.startswith("os-")]
        if os_classes:
            class_selector = f'{tag_name}.{".".join(os_classes[:2])}'
            identifiers.append({
                "type": "outsystems_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.90,
                "app_specific": True,
                "app_type": "outsystems",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "OutSystems class selector"
            })
            priority += 1
        
        # 3. Stable ID (if not dynamic)
        element_id = attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _generate_mendix_identifiers(
        self,
        tag_name: str,
        attributes: Dict[str, Any],
        text_content: str,
        aria_label: Optional[str],
        role: Optional[str],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate identifiers for Mendix elements"""
        identifiers = []
        priority = 1
        
        # 1. Mendix data-mx-* attributes
        mx_attrs = {k: v for k, v in attributes.items() if k.startswith("data-mx-")}
        if mx_attrs:
            for key, value in mx_attrs.items():
                if value:
                    identifiers.append({
                        "type": "mendix_data_attribute",
                        "value": f"{key}={value}",
                        "priority": priority,
                        "confidence": 0.95,
                        "app_specific": True,
                        "app_type": "mendix",
                        "playwright_locator": f'page.locator(\'[{key}="{value}"]\')',
                        "reason": "Mendix data attribute is most stable"
                    })
                    priority += 1
                    break
        
        # 2. Mendix classes (mx-)
        classes = attributes.get("class", "").split()
        mx_classes = [c for c in classes if c.startswith("mx-")]
        if mx_classes:
            class_selector = f'{tag_name}.{".".join(mx_classes[:2])}'
            identifiers.append({
                "type": "mendix_class",
                "value": class_selector,
                "priority": priority,
                "confidence": 0.90,
                "app_specific": True,
                "app_type": "mendix",
                "playwright_locator": f"page.locator('{class_selector}')",
                "reason": "Mendix class selector"
            })
            priority += 1
        
        # 3. Stable ID (if not dynamic)
        element_id = attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            identifiers.append({
                "type": "id",
                "value": element_id,
                "priority": priority,
                "confidence": 0.85,
                "app_specific": False,
                "playwright_locator": f"page.locator('#{element_id}')",
                "reason": "Stable ID selector"
            })
            priority += 1
        
        # 4. Role + name (semantic fallback)
        inferred_role = role or self._infer_role(tag_name, attributes)
        if inferred_role and text_content:
            identifiers.append({
                "type": "role_name",
                "role": inferred_role,
                "name": text_content[:50],
                "priority": priority,
                "confidence": 0.75,
                "app_specific": False,
                "playwright_locator": f'page.getByRole("{inferred_role}", {{ name: "{text_content[:50]}" }})',
                "reason": "Semantic locator fallback"
            })
        
        return identifiers
    
    def _is_dynamic_id(self, element_id: str) -> bool:
        """Check if ID is dynamic (should be avoided)"""
        dynamic_patterns = [
            r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',  # UUID
            r'^react-.*$',
            r'^vue-.*$',
            r'^angular-.*$',
            r'^[0-9]+$',  # All numbers
            r'^id-[0-9]+$',
        ]
        return any(re.match(pattern, element_id) for pattern in dynamic_patterns)
    
    def _is_dynamic_class(self, class_name: str) -> bool:
        """Check if class is dynamic (should be avoided)"""
        dynamic_patterns = ['lwc-', 'react-', 'ng-', 'vue-', 'ember-']
        return any(pattern in class_name for pattern in dynamic_patterns)
    
    def _infer_role(self, tag_name: str, attributes: Dict[str, Any]) -> Optional[str]:
        """Infer ARIA role from tag name and attributes"""
        # Check explicit role first
        if attributes.get("role"):
            return attributes["role"]
        
        # Infer from tag name
        role_map = {
            "button": "button",
            "a": "link",
            "input": "textbox" if attributes.get("type") != "button" else "button",
            "textarea": "textbox",
            "select": "combobox",
            "img": "img",
            "nav": "navigation",
            "header": "banner",
            "footer": "contentinfo",
        }
        
        return role_map.get(tag_name.lower())
    
    async def build_element_model(
        self,
        element_data: Dict[str, Any],
        application_type: ApplicationType,
        page_id: Optional[str] = None,
        page_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Build element model from element data.
        
        Args:
            element_data: Element metadata from DOM
            application_type: Detected application type
            page_id: Optional page object ID
            page_context: Optional page context for naming
            
        Returns:
            Element model dictionary
        """
        # Generate element name
        element_name = self.generate_element_name(element_data, page_context)
        
        # Generate identifiers
        identifiers = self.generate_identifiers(element_data, application_type)
        
        # Extract element type
        element_type = element_data.get("tag_name", "unknown").lower()
        
        # Create metadata
        metadata = {
            "tag_name": element_data.get("tag_name"),
            "original_id": element_data.get("id"),
            "original_classes": element_data.get("class_name"),
            "text_content": element_data.get("text_content", "")[:200],  # Limit length
        }
        
        # Find or create element model (with database fallback)
        try:
            element_model = await self.element_model_service.find_or_create_element_model(
                element_name=element_name,
                element_type=element_type,
                application_type=application_type.value,
                identifiers=identifiers,
                page_id=page_id,
                metadata=metadata
            )
            logger.info(f"Built element model (DB): {element_name} with {len(identifiers)} identifiers")
        except Exception as db_error:
            # CRITICAL: Fallback to in-memory element model when database unavailable
            logger.warning(f"Database unavailable, creating in-memory element model: {db_error}")
            from uuid import uuid4
            element_model = {
                "element_id": str(uuid4()),
                "element_name": element_name,
                "element_type": element_type,
                "application_type": application_type.value,
                "identifiers": identifiers,
                "metadata": metadata,
                "page_id": page_id
            }
            logger.info(f"Built element model (in-memory): {element_name} with {len(identifiers)} identifiers")
        
        return element_model

